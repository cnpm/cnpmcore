import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import path from 'path';
import { NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { BinarySyncerService } from '../../core/service/BinarySyncerService';
import { Binary } from '../../core/entity/Binary';
import binaries from '../../../config/binaries';

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
    return Object.entries(binaries).map(([ binaryName, binaryConfig ]) => {
      return {
        name: `${binaryName}/`,
        category: `${binaryConfig.category}/`,
        description: binaryConfig.description,
        distUrl: binaryConfig.distUrl,
        repoUrl: /^https?:\/\//.test(binaryConfig.repo) ? binaryConfig.repo : `https://github.com/${binaryConfig.repo}`,
        type: 'dir',
        url: `${this.config.cnpmcore.registry}/-/binary/${binaryConfig.category}/`,
      };
    });
  }

  @HTTPMethod({
    path: '/-/binary/:binaryName(@[^/]{1,220}\/[^/]{1,220}|[^@/]{1,220})/:subpath(.*)',
    method: HTTPMethodEnum.GET,
  })
  async showBinary(@Context() ctx: EggContext, @HTTPParam() binaryName: string, @HTTPParam() subpath: string) {
    subpath = subpath || '/';
    if (subpath === '/') {
      const items = await this.binarySyncerService.listRootBinaries(binaryName);
      return this.formatItems(items);
    }
    subpath = `/${subpath}`;
    const parsed = path.parse(subpath);
    const parent = parsed.dir === '/' ? '/' : `${parsed.dir}/`;
    const name = subpath.endsWith('/') ? `${parsed.base}/` : parsed.base;
    // 首先查询 binary === category 的情况
    let binary = await this.binarySyncerService.findBinary(binaryName, parent, name);
    if (!binary) {
      // 查询不到再去查询 mergeCategory 的情况
      const category = binaries?.[binaryName]?.category;
      if (category) {
        // canvas/v2.6.1/canvas-v2.6.1-node-v57-linux-glibc-x64.tar.gz
        // -> node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz
        binary = await this.binarySyncerService.findBinary(category, parent, name.replace(new RegExp(`^${binaryName}-`), `${category}-`));
      }
    }

    if (!binary) {
      throw new NotFoundError(`Binary "${binaryName}${subpath}" not found`);
    }
    if (binary.isDir) {
      const items = await this.binarySyncerService.listDirBinaries(binary);
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
    path: '/-/binary/:binaryName(@[^/]{1,220}\/[^/]{1,220}|[^@/]{1,220})',
    method: HTTPMethodEnum.GET,
  })
  async showBinaryIndex(@Context() ctx: EggContext, @HTTPParam() binaryName: string) {
    return await this.showBinary(ctx, binaryName, '/');
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
