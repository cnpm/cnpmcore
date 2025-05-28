import {
  type EggContext,
  Context,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Middleware,
  HTTPBody,
} from '@eggjs/tegg';
import path from 'node:path';
import { NotFoundError } from 'egg-errors';

import { AbstractController } from './AbstractController.js';
import type { BinarySyncerService } from '../../core/service/BinarySyncerService.js';
import type { Binary } from '../../core/entity/Binary.js';
import binaries, { type BinaryName } from '../../../config/binaries.js';
import { BinaryNameRule, BinarySubpathRule } from '../typebox.js';
import { AdminAccess } from '../middleware/AdminAccess.js';

@HTTPController()
export class BinarySyncController extends AbstractController {
  @Inject()
  private binarySyncerService: BinarySyncerService;

  @HTTPMethod({
    path: '/binary.html',
    method: HTTPMethodEnum.GET,
  })
  async showBinaryHTML(@Context() ctx: EggContext) {
    ctx.type = 'html';
    return ctx.app.binaryHTML;
  }

  @HTTPMethod({
    path: '/-/binary/',
    method: HTTPMethodEnum.GET,
  })
  async listBinaries() {
    return Object.entries(binaries).map(([binaryName, binaryConfig]) => {
      return {
        name: `${binaryName}/`,
        category: `${binaryConfig.category}/`,
        description: binaryConfig.description,
        distUrl: binaryConfig.distUrl,
        repoUrl: /^https?:\/\//.test(binaryConfig.repo)
          ? binaryConfig.repo
          : `https://github.com/${binaryConfig.repo}`,
        type: 'dir',
        url: `${this.config.cnpmcore.registry}/-/binary/${binaryConfig.category}/`,
      };
    });
  }

  @HTTPMethod({
    path: '/-/binary/:binaryName(@[^/]{1,220}/[^/]{1,220}|[^@/]{1,220})/:subpath(.*)',
    method: HTTPMethodEnum.GET,
  })
  async showBinary(
    @Context() ctx: EggContext,
    @HTTPParam() binaryName: BinaryName,
    @HTTPParam() subpath: string,
    @HTTPQuery() since: string,
    @HTTPQuery() limit: string
  ) {
    // check binaryName valid
    try {
      ctx.tValidate(BinaryNameRule, binaryName);
    } catch {
      throw new NotFoundError(`Binary "${binaryName}" not found`);
    }
    let limitCount: number | undefined;
    if (limit) {
      limitCount = Number(limit);
      if (Number.isNaN(limitCount)) {
        throw new NotFoundError(`invalidate limit "${limit}"`);
      }
      if (limitCount > 1000) {
        throw new NotFoundError(
          `limit should less than 1000, query is "${limit}"`
        );
      }
    }
    subpath = subpath || '/';
    if (subpath === '/') {
      const items = await this.binarySyncerService.listRootBinaries(binaryName);
      return this.formatItems(items);
    }
    try {
      ctx.tValidate(BinarySubpathRule, subpath);
    } catch {
      throw new NotFoundError(`Binary "${binaryName}/${subpath}" not found`);
    }
    subpath = `/${subpath}`;
    const parsed = path.parse(subpath);
    const parent = parsed.dir === '/' ? '/' : `${parsed.dir}/`;
    const name = subpath.endsWith('/') ? `${parsed.base}/` : parsed.base;
    // 首先查询 binary === category 的情况
    let binary = await this.binarySyncerService.findBinary(
      binaryName,
      parent,
      name
    );
    if (!binary) {
      // 查询不到再去查询 mergeCategory 的情况
      const category = binaries?.[binaryName]?.category;
      if (category) {
        // canvas/v2.6.1/canvas-v2.6.1-node-v57-linux-glibc-x64.tar.gz
        // -> node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz
        binary = await this.binarySyncerService.findBinary(
          category,
          parent,
          name.replace(new RegExp(`^${binaryName}-`), `${category}-`)
        );
      }
    }

    if (!binary) {
      throw new NotFoundError(`Binary "${binaryName}${subpath}" not found`);
    }
    if (binary.isDir) {
      let options;
      if (limitCount && since) {
        options = {
          limit: limitCount,
          since,
        };
      }
      const items = await this.binarySyncerService.listDirBinaries(
        binary,
        options
      );
      return this.formatItems(items);
    }

    // download file
    const urlOrStream = await this.binarySyncerService.downloadBinary(binary);
    if (!urlOrStream) {
      throw new NotFoundError(`Binary "${binaryName}${subpath}" not found`);
    }
    if (typeof urlOrStream === 'string') {
      ctx.redirect(urlOrStream);
      return;
    }
    ctx.attachment(name);
    return urlOrStream;
  }

  @HTTPMethod({
    path: '/-/binary/:binaryName/sync',
    method: HTTPMethodEnum.POST,
  })
  @Middleware(AdminAccess)
  async syncBinary(
    @Context() ctx: EggContext,
    @HTTPParam() binaryName: BinaryName,
    @HTTPBody() lastData?: Record<string, string>
  ) {
    // check binaryName valid
    try {
      ctx.tValidate(BinaryNameRule, binaryName);
    } catch {
      throw new NotFoundError(`Binary "${binaryName}" not found`);
    }
    this.logger.info('SyncBinary: %s, lastData: %j', binaryName, lastData);
    const task = await this.binarySyncerService.createTask(
      binaryName,
      lastData
    );
    return {
      ok: true,
      taskId: task?.taskId,
      logPath: task?.logPath,
    };
  }

  @HTTPMethod({
    path: '/-/binary/:binaryName(@[^/]{1,220}/[^/]{1,220}|[^@/]{1,220})',
    method: HTTPMethodEnum.GET,
  })
  async showBinaryIndex(
    @Context() ctx: EggContext,
    @HTTPParam() binaryName: BinaryName,
    @HTTPQuery() since: string,
    @HTTPQuery() limit: string
  ) {
    // check binaryName valid
    try {
      ctx.tValidate(BinaryNameRule, binaryName);
    } catch {
      throw new NotFoundError(`Binary "${binaryName}" not found`);
    }
    return await this.showBinary(ctx, binaryName, '/', since, limit);
  }

  private formatItems(items: Binary[]) {
    return items.map(item => {
      return {
        id: item.binaryId,
        category: item.category,
        name: item.name,
        date: item.date,
        type: item.isDir ? 'dir' : 'file',
        size: item.isDir ? undefined : item.size,
        url: `${this.config.cnpmcore.registry}/-/binary/${item.category}${item.parent}${item.name}`,
        modified: item.updatedAt,
      };
    });
  }
}
