import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Inject,
  HTTPQuery,
  HTTPParam,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { ForbiddenError, NotFoundError, UnauthorizedError, NotImplementedError } from 'egg-errors';
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
import { CacheService } from '../../core/service/CacheService';

@HTTPController()
export class ProxyCacheController extends AbstractController {
  @Inject()
  private readonly proxyCacheRepository: ProxyCacheRepository;
  @Inject()
  private readonly proxyCacheService: ProxyCacheService;
  @Inject()
  private readonly cacheService: CacheService;

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
  async showProxyCaches(@HTTPQuery() pageSize: Static<typeof QueryPageOptions>['pageSize'],
  @HTTPQuery() pageIndex: Static<typeof QueryPageOptions>['pageIndex'], @HTTPParam() fullname: string) {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }
    return await this.proxyCacheRepository.listCachedFiles({
      pageSize,
      pageIndex,
    }, fullname);
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
    await this.cacheService.removeCache(fullname);
    const taskList = refreshList
      // only refresh package.json and abbreviated.json
      .filter(i => isPkgManifest(i.fileType))
      .map(item => {
        const task = this.proxyCacheService.createTask(
          `${item.fullname}/${item.fileType}`,
          {
            fullname: item.fullname,
            fileType: item.fileType,
          },
        );
        return task;
      });
    const tasks = await Promise.all(taskList);
    return {
      ok: true,
      tasks,
    };
  }

  @HTTPMethod({
    method: HTTPMethodEnum.DELETE,
    path: `/-/proxy-cache/:fullname(${FULLNAME_REG_STRING})`,
  })
  async removeProxyCaches(@HTTPParam() fullname: string) {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      throw new ForbiddenError('proxy mode is not enabled');
    }

    const proxyCachesList = await this.proxyCacheRepository.findProxyCaches(
      fullname,
    );
    if (proxyCachesList.length === 0) {
      throw new NotFoundError();
    }
    await this.cacheService.removeCache(fullname);
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

    throw new NotImplementedError('not implemented yet');
  }
}
