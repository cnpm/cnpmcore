import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { isSyncWorkerRequest } from '../../../common/SyncUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { ProxyCacheService } from '../../../core/service/ProxyCacheService';
import { Spec } from '../../../port/typebox';
import { SyncMode } from '../../../common/constants';
import { DIST_NAMES } from '../../../core/entity/Package';

@HTTPController()
export class ShowPackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private proxyCacheService: ProxyCacheService;

  @HTTPMethod({
    // GET /:fullname/:versionSpec
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionSpec`,
    method: HTTPMethodEnum.GET,
  })
  async show(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() versionSpec: string) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    const [ scope, name ] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const abbreviatedMetaType = 'application/vnd.npm.install-v1+json';
    const isFullManifests = ctx.accepts([ 'json', abbreviatedMetaType ]) !== abbreviatedMetaType;

    let { blockReason, manifest, pkg } = await this.packageManagerService.showPackageVersionManifest(scope, name, versionSpec, isSync, isFullManifests);
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    if (!pkg) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        try {
          manifest = await this.proxyCacheService.getPackageVersionManifest(fullname, fileType, versionSpec);
        } catch (error) {
          // 缓存manifest错误，创建刷新缓存任务
          await this.proxyCacheService.createTask(`${fullname}/${fileType}`, { fullname, fileType });
          throw error;
        }
      } else {
        const allowSync = this.getAllowSync(ctx);
        throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
      }
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionSpec);
    }
    if (!manifest) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        manifest = await this.proxyCacheService.getPackageVersionManifest(fullname, fileType, versionSpec);
      } else {
        throw new NotFoundError(`${fullname}@${versionSpec} not found`);
      }
    }
    this.setCDNHeaders(ctx);
    return manifest;
  }
}
