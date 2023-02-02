import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { isSyncWorkerRequest } from '../../../common/SyncUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { ProxyModeService } from '../../../core/service/ProxyModeService';
import { NotFoundError } from 'egg-errors';

@HTTPController()
export class ShowPackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private proxyModeService: ProxyModeService;

  @HTTPMethod({
    // GET /:fullname/:versionOrTag
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionOrTag`,
    method: HTTPMethodEnum.GET,
  })
  async show(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() versionOrTag: string) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const [ scope, name ] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    let { blockReason, manifest, pkgId } = await this.packageManagerService.showPackageVersionManifest(scope, name, versionOrTag, isSync);
    if (!pkgId) {
      if (this.isEnableProxyMode) {
        manifest = await this.proxyModeService.getPackageVersionOrTagManifest(fullname, versionOrTag);
      } else {
        const allowSync = this.getAllowSync(ctx);
        throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
      }
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionOrTag);
    }
    if (!manifest) {
      if (this.isEnableProxyMode) {
        manifest = await this.proxyModeService.getPackageVersionOrTagManifest(fullname, versionOrTag);
      } else {
        throw new NotFoundError(`${fullname}@${versionOrTag} not found`);
      }
    }
    this.setCDNHeaders(ctx);
    return manifest;
  }
}
