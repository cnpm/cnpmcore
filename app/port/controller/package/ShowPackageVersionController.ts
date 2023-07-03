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
import { ProxyModeService } from '../../../core/service/ProxyModeService';
import { Spec } from '../../../port/typebox';
import { SyncMode } from '../../../common/constants';

@HTTPController()
export class ShowPackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private proxyModeService: ProxyModeService;

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
    if (!pkg) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        manifest = await this.proxyModeService.getPackageVersionOrTagManifest(fullname, versionSpec, isFullManifests);
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
        manifest = await this.proxyModeService.getPackageVersionOrTagManifest(fullname, versionSpec, isFullManifests);
      } else {
        throw new NotFoundError(`${fullname}@${versionSpec} not found`);
      }
    }
    this.setCDNHeaders(ctx);
    return manifest;
  }
}
