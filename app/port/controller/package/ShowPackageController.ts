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
    const abbreviatedMetaType = 'application/vnd.npm.install-v1+json';
    const isFullManifests = ctx.accepts([ 'json', abbreviatedMetaType ]) !== abbreviatedMetaType;
    // handle cache
    const cacheEtag = await this.cacheService.getPackageEtag(fullname, isFullManifests);
    if (cacheEtag) {
      let requestEtag = ctx.request.get('if-none-match');
      if (requestEtag.startsWith('W/')) {
        requestEtag = requestEtag.substring(2);
      }
      if (requestEtag === cacheEtag) {
        // match etag, set status 304
        ctx.status = 304;
        return;
      }
      // get cache pkg data
      const cacheBytes = await this.cacheService.getPackageManifests(fullname, isFullManifests);
      if (cacheBytes && cacheBytes.length > 0) {
        ctx.set('etag', `W/${cacheEtag}`);
        ctx.type = 'json';
        return cacheBytes;
      }
    }

    // handle cache miss
    let result: { etag: string; data: any };
    if (isFullManifests) {
      result = await this.packageManagerService.listPackageFullManifests(scope, name);
    } else {
      result = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name);
    }
    const { etag, data } = result;
    // 404, no data
    if (!etag) {
      throw this.createPackageNotFoundError(fullname);
    }

    // set cache
    const cacheBytes = Buffer.from(JSON.stringify(data));
    await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, cacheBytes);

    // set etag
    // https://forum.nginx.org/read.php?2,240120,240120#msg-240120
    // should set weak etag avoid nginx remove it
    ctx.set('etag', `W/${etag}`);
    ctx.type = 'json';
    return cacheBytes;
  }
}
