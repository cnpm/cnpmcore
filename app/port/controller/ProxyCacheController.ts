import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Inject,
  HTTPQuery,
  HTTPParam,
  Context,
  EggContext,
  // Context,
  // EggContext,
} from '@eggjs/tegg';
import { ForbiddenError, NotFoundError, UnauthorizedError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { Static } from 'egg-typebox-validate/typebox';
import { QueryPageOptions } from '../typebox';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';
import {
  ProxyCacheService,
  isPkgManifest,
} from '../../core/service/ProxyCacheService';
import { SyncMode } from '../../common/constants';
// import { DIST_NAMES } from '../../../core/entity/Package';

@HTTPController()
export class ProxyCacheController extends AbstractController {
  @Inject()
  private readonly proxyCacheRepository: ProxyCacheRepository;

  @Inject()
  private readonly proxyCacheService: ProxyCacheService;

  @HTTPMethod({
    method: HTTPMethodEnum.GET,
    path: '/-/proxy-cache',
  })
  async listProxyCache(
    @HTTPQuery() pageSize: Static<typeof QueryPageOptions>['pageSize'],
    @HTTPQuery() pageIndex: Static<typeof QueryPageOptions>['pageIndex'],
  ) {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }
    return await this.proxyCacheRepository.listCachedFiles({
      pageSize,
      pageIndex,
    });
  }

  @HTTPMethod({
    method: HTTPMethodEnum.GET,
    path: `/-/proxy-cache/:fullname(${FULLNAME_REG_STRING})`,
  })
  async showProxyCaches(@HTTPParam() fullname: string) {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }
    const result = await this.proxyCacheRepository.findProxyCaches(fullname);
    if (result.length === 0) {
      throw new NotFoundError();
    }
    return result;
  }

  @HTTPMethod({
    method: HTTPMethodEnum.PATCH,
    path: `/-/proxy-cache/:fullname(${FULLNAME_REG_STRING})`,
  })
  async refreshProxyCaches(@HTTPParam() fullname: string) {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }

    const refreshList = await this.proxyCacheRepository.findProxyCaches(
      fullname,
    );
    if (refreshList.length === 0) {
      throw new NotFoundError();
    }
    const taskList = refreshList
      // 仅manifests需要更新，指定版本的package.json文件发布后不会改变
      .filter(i => isPkgManifest(i.fileType))
      .map(async item => {
        const task = await this.proxyCacheService.createTask(
          `${item.fullname}/${item.fileType}`,
          {
            fullname: item.fullname,
            fileType: item.fileType,
          },
        );
        return task;
      });
    return {
      ok: true,
      tasks: await Promise.all(taskList),
    };
  }

  @HTTPMethod({
    method: HTTPMethodEnum.DELETE,
    path: `/-/proxy-cache/:fullname(${FULLNAME_REG_STRING})`,
  })
  async removeProxyCaches(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new UnauthorizedError('only admin can do this');
    }

    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }

    const proxyCachesList = await this.proxyCacheRepository.findProxyCaches(
      fullname,
    );
    if (proxyCachesList.length === 0) {
      throw new NotFoundError();
    }
    const removingList = proxyCachesList.map(item => {
      return this.proxyCacheService.removeProxyCache(item.fullname, item.fileType, item.version);
    });
    await Promise.all(removingList);
    return {
      ok: true,
      result: proxyCachesList,
    };
  }

  @HTTPMethod({
    method: HTTPMethodEnum.DELETE,
    path: '/-/proxy-cache',
  })
  async truncateProxyCaches(@Context() ctx: EggContext) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new UnauthorizedError('only admin can do this');
    }

    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }

    // 需要手动清除对象存储上的缓存
    await this.proxyCacheRepository.truncateProxyCache();

    return {
      ok: true,
    };
  }
}
