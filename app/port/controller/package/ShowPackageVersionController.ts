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
import {
  getScopeAndName,
  FULLNAME_REG_STRING,
} from '../../../common/PackageUtil';
import { isSyncWorkerRequest } from '../../../common/SyncUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { ProxyCacheService } from '../../../core/service/ProxyCacheService';
import { Spec } from '../../../port/typebox';
import { ABBREVIATED_META_TYPE, SyncMode } from '../../../common/constants';
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
  async show(
    @Context() ctx: EggContext,
    @HTTPParam() fullname: string,
    @HTTPParam() versionSpec: string,
  ) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    const [ scope, name ] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const isFullManifests =
      ctx.accepts([ 'json', ABBREVIATED_META_TYPE ]) !== ABBREVIATED_META_TYPE;

    const { blockReason, manifest, pkg } =
      await this.packageManagerService.showPackageVersionManifest(
        scope,
        name,
        versionSpec,
        isSync,
        isFullManifests,
      );
    const allowSync = this.getAllowSync(ctx);

    if (!pkg || !manifest) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        const fileType = isFullManifests
          ? DIST_NAMES.MANIFEST
          : DIST_NAMES.ABBREVIATED;
        return await this.proxyCacheService.getPackageVersionManifest(
          fullname,
          fileType,
          versionSpec,
        );
      }

      if (!manifest) {
        throw this.createPackageNotFoundErrorWithRedirect(fullname, versionSpec, allowSync);
      }

      if (!pkg) {
        throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
      }
    }

    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionSpec);
    }

    this.setCDNHeaders(ctx);
    return manifest;
  }
}
