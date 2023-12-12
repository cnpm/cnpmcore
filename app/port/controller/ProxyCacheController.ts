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
import { AbstractController } from './AbstractController';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { Static } from 'egg-typebox-validate/typebox';
import { QueryPageOptions } from '../typebox';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';
import {
  ProxyCacheService,
  isPkgManifest,
} from '../../core/service/ProxyCacheService';
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
    return await this.proxyCacheRepository.findProxyCaches(fullname);
  }

  @HTTPMethod({
    method: HTTPMethodEnum.PATCH,
    path: `/-/proxy-cache/:fullname(${FULLNAME_REG_STRING})`,
  })
  async refreshProxyCaches(@HTTPParam() fullname: string) {
    const refreshList = await this.proxyCacheRepository.findProxyCaches(
      fullname,
    );
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
      return {
        ok: false,
        error: 'only admin can do this',
      };
    }

    const proxyCachesList = await this.proxyCacheRepository.findProxyCaches(
      fullname,
    );
    const removingList = proxyCachesList.map(item => {
      return this.proxyCacheService.removeProxyCaches(item.fullname, item.fileType, item.version);
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
      return {
        ok: false,
        error: 'only admin can do this',
      };
    }

    // 需要手动清除对象存储上的缓存
    await this.proxyCacheRepository.truncateProxyCache();

    return {
      ok: true,
    };
  }
}
