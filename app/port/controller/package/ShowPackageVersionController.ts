import {
  type EggContext,
  Context,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';

import { AbstractController } from '../AbstractController.ts';
import {
  FULLNAME_REG_STRING,
  getScopeAndName,
} from '../../../common/PackageUtil.ts';
import { isSyncWorkerRequest } from '../../../common/SyncUtil.ts';
import type { PackageManagerService } from '../../../core/service/PackageManagerService.ts';
import type { ProxyCacheService } from '../../../core/service/ProxyCacheService.ts';
import { Spec } from '../../../port/typebox.ts';
import { ABBREVIATED_META_TYPE, SyncMode } from '../../../common/constants.ts';
import { DIST_NAMES } from '../../../core/entity/Package.ts';

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
    @HTTPParam() versionSpec: string
  ) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    const [scope, name] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const isFullManifests =
      ctx.accepts(['json', ABBREVIATED_META_TYPE]) !== ABBREVIATED_META_TYPE;

    const { blockReason, manifest, pkg } =
      await this.packageManagerService.showPackageVersionManifest(
        scope,
        name,
        versionSpec,
        isSync,
        isFullManifests
      );
    const allowSync = this.getAllowSync(ctx);

    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionSpec);
    }

    if (!pkg || !manifest) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        const fileType = isFullManifests
          ? DIST_NAMES.MANIFEST
          : DIST_NAMES.ABBREVIATED;
        return await this.proxyCacheService.getPackageVersionManifest(
          fullname,
          fileType,
          versionSpec
        );
      }

      if (!pkg) {
        throw this.createPackageNotFoundErrorWithRedirect(
          fullname,
          undefined,
          allowSync
        );
      }
      if (!manifest) {
        throw new NotFoundError(`${fullname}@${versionSpec} not found`);
      }
    }

    this.setCDNHeaders(ctx);
    return manifest;
  }
}
