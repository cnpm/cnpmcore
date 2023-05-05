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

@HTTPController()
export class ShowPackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname/:versionOrTag
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionOrTag`,
    method: HTTPMethodEnum.GET,
  })
  async show(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() versionOrTag: string) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const [ scope, name ] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const { blockReason, manifest, pkg } = await this.packageManagerService.showPackageVersionManifest(scope, name, versionOrTag, isSync);
    if (!pkg) {
      const allowSync = this.getAllowSync(ctx);
      throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionOrTag);
    }
    if (!manifest) {
      throw new NotFoundError(`${fullname}@${versionOrTag} not found`);
    }
    this.setCDNHeaders(ctx);
    return manifest;
  }
}
