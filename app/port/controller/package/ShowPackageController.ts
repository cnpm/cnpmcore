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
import { CacheService } from '../../../core/service/CacheService';
import { SyncMode } from '../../../common/constants';
import { ProxyCacheService } from '../../../core/service/ProxyCacheService';
import { calculateIntegrity } from '../../../common/PackageUtil';
import { DIST_NAMES } from '../../../core/entity/Package';

@HTTPController()
export class ShowPackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private cacheService: CacheService;
  @Inject()
  private proxyCacheService: ProxyCacheService;

  @HTTPMethod({
    // GET /:fullname
    // https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
    path: `/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async show(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    const isSync = isSyncWorkerRequest(ctx);
    const abbreviatedMetaType = 'application/vnd.npm.install-v1+json';
    const isFullManifests = ctx.accepts([ 'json', abbreviatedMetaType ]) !== abbreviatedMetaType;

    // handle cache
    // fallback to db when cache error
    try {
      const cacheEtag = await this.cacheService.getPackageEtag(fullname, isFullManifests);
      if (!isSync && cacheEtag) {
        let requestEtag = ctx.request.get('if-none-match');
        if (requestEtag.startsWith('W/')) {
          requestEtag = requestEtag.substring(2);
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
    let result: { etag: string; data: any, blockReason: string };
    if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
      // proxy mode
      const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
      const pkgManifest = await this.proxyCacheService.getPackageManifest(fullname, fileType);
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
}
