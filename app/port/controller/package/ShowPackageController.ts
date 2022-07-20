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

@HTTPController()
export class ShowPackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private cacheService: CacheService;

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

    // handle cache miss
    let result: { etag: string; data: any, blockReason: string };
    if (isFullManifests) {
      result = await this.packageManagerService.listPackageFullManifests(scope, name, isSync);
    } else {
      result = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, isSync);
    }
    const { etag, data, blockReason } = result;
    // 404, no data
    if (!etag) {
      // don't set cdn header, no cdn cache for new package to sync as soon as possible
      throw this.createPackageNotFoundError(fullname);
    }
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname);
    }

    const cacheBytes = Buffer.from(JSON.stringify(data));
    // only set cache with normal request
    // sync request response with no bug version fixed
    if (!isSync) {
      await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, cacheBytes);
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
