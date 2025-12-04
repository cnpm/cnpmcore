import { HTTPContext, Context, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam, Inject } from 'egg';

import { ABBREVIATED_META_TYPE, SyncMode } from '../../../common/constants.ts';
import { FULLNAME_REG_STRING, getScopeAndName, calculateIntegrity } from '../../../common/PackageUtil.ts';
import { isSyncWorkerRequest } from '../../../common/SyncUtil.ts';
import { DIST_NAMES } from '../../../core/entity/Package.ts';
import { BugVersionService } from '../../../core/service/BugVersionService.ts';
import type { CacheService } from '../../../core/service/CacheService.ts';
import type { PackageManagerService } from '../../../core/service/PackageManagerService.ts';
import type { ProxyCacheService } from '../../../core/service/ProxyCacheService.ts';
import { AbstractController } from '../AbstractController.ts';

@HTTPController()
export class ShowPackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private cacheService: CacheService;
  @Inject()
  private proxyCacheService: ProxyCacheService;
  @Inject()
  private bugVersionService: BugVersionService;

  @HTTPMethod({
    // GET /:fullname
    // https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
    path: `/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async show(@HTTPContext() ctx: Context, @HTTPParam() fullname: string) {
    // TODO: need to support proxy mode with JSONBuilder
    if (this.config.cnpmcore.experimental.enableJSONBuilder && this.config.cnpmcore.syncMode !== SyncMode.proxy) {
      const hasBugVersions = await this.bugVersionService.hasBugVersions(fullname);
      if (!hasBugVersions) {
        // no bug versions, use JSONBuilder
        return await this.showWithJSONBuilder(ctx, fullname);
      }
    }
    const [scope, name] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const isFullManifests = ctx.accepts(['json', ABBREVIATED_META_TYPE]) !== ABBREVIATED_META_TYPE;

    // handle cache
    // fallback to db when cache error
    try {
      const cacheEtag = await this.cacheService.getPackageEtag(fullname, isFullManifests);
      if (!isSync && cacheEtag) {
        let requestEtag = ctx.request.get<string>('if-none-match');
        if (requestEtag.startsWith('W/')) {
          requestEtag = requestEtag.slice(2);
        }
        if (requestEtag === cacheEtag) {
          // make sure CDN cache header set here
          this.setCDNHeaders(ctx);
          // match etag, set status 304
          ctx.status = 304;
          return;
        }
        // get cache pkg data
        const cacheBytes = await this.cacheService.getPackageManifests(fullname, isFullManifests);
        if (cacheBytes && cacheBytes.length > 0) {
          ctx.set('etag', `W/${cacheEtag}`);
          ctx.type = 'json';
          this.setCDNHeaders(ctx);
          return cacheBytes;
        }
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.error('[ShowPackageController.show:error] get cache error, ignore');
    }

    // handle cache miss
    let result: { etag: string; data: unknown; blockReason: string };
    if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
      // proxy mode
      const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
      const { data: sourceManifest } = await this.proxyCacheService.getProxyResponse(ctx, {
        dataType: 'json',
      });
      const pkgManifest = this.proxyCacheService.replaceTarballUrl(sourceManifest, fileType);

      const nfsBytes = Buffer.from(JSON.stringify(pkgManifest));
      const { shasum: etag } = await calculateIntegrity(nfsBytes);
      result = { data: pkgManifest, etag, blockReason: '' };
    } else {
      // sync mode
      if (isFullManifests) {
        result = await this.packageManagerService.listPackageFullManifests(scope, name, isSync);
      } else {
        result = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, isSync);
      }
    }
    const { etag, data, blockReason } = result;
    // 404, no data
    if (!etag) {
      const allowSync = this.getAllowSync(ctx);
      // don't set cdn header, no cdn cache for new package to sync as soon as possible
      throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname);
    }

    const cacheBytes = Buffer.from(JSON.stringify(data));
    // only set cache with normal request
    // sync request response with no bug version fixed
    if (!isSync) {
      ctx.runInBackground(async () => {
        await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, cacheBytes);
      });
    }

    // set etag
    // https://forum.nginx.org/read.php?2,240120,240120#msg-240120
    // should set weak etag avoid nginx remove it
    ctx.set('etag', `W/${etag}`);
    ctx.type = 'json';
    this.setCDNHeaders(ctx);
    return cacheBytes;
  }

  private async showWithJSONBuilder(ctx: Context, fullname: string) {
    const [scope, name] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const isFullManifests = ctx.accepts(['json', ABBREVIATED_META_TYPE]) !== ABBREVIATED_META_TYPE;

    // handle cache
    // fallback to db when cache error
    if (!isSync) {
      try {
        const cacheEtag = await this.cacheService.getPackageEtagV2(fullname, isFullManifests);
        if (cacheEtag) {
          let requestEtag = ctx.request.get<string>('if-none-match');
          if (requestEtag.startsWith('W/')) {
            requestEtag = requestEtag.slice(2);
          }
          if (requestEtag === cacheEtag) {
            // make sure CDN cache header set here
            this.setCDNHeaders(ctx);
            // match etag, set status 304
            ctx.status = 304;
            return;
          }
        }
      } catch (e) {
        this.logger.error(e);
        this.logger.error('[ShowPackageController.show:error] get cache error, ignore');
      }
    }

    // handle cache miss
    let result: { etag: string; data: Buffer | null; blockReason: string };
    // sync mode
    if (isFullManifests) {
      result = await this.packageManagerService.listPackageFullManifestsBuffer(scope, name);
    } else {
      result = await this.packageManagerService.listPackageAbbreviatedManifestsBuffer(scope, name);
    }
    const { etag, data, blockReason } = result;
    // 404, no data
    if (!etag || !data) {
      const allowSync = this.getAllowSync(ctx);
      // don't set cdn header, no cdn cache for new package to sync as soon as possible
      throw this.createPackageNotFoundErrorWithRedirect(fullname, undefined, allowSync);
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname);
    }

    // only set cache with normal request
    // sync request response with no bug version fixed
    if (!isSync) {
      ctx.runInBackground(async () => {
        await this.cacheService.savePackageEtagV2(fullname, isFullManifests, etag);
      });
    }

    // set etag
    // https://forum.nginx.org/read.php?2,240120,240120#msg-240120
    // should set weak etag avoid nginx remove it
    ctx.set('etag', `W/${etag}`);
    ctx.type = 'json';
    this.setCDNHeaders(ctx);
    return data;
  }
}
