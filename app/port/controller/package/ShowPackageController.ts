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

@HTTPController()
export class ShowPackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname
    // https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
    path: `/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async show(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    const requestEtag = ctx.request.headers['if-none-match'];
    const abbreviatedMetaType = 'application/vnd.npm.install-v1+json';
    let result: { etag: string; data: any };
    if (ctx.accepts([ 'json', abbreviatedMetaType ]) === abbreviatedMetaType) {
      result = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, requestEtag);
    } else {
      result = await this.packageManagerService.listPackageFullManifests(scope, name, requestEtag);
    }
    const { etag, data } = result;
    // 404, no data
    if (!etag) {
      throw this.createPackageNotFoundError(fullname);
    }

    if (data) {
      // set etag
      // https://forum.nginx.org/read.php?2,240120,240120#msg-240120
      // should set weak etag avoid nginx remove it
      ctx.set('etag', `W/${etag}`);
    } else {
      // match etag, set status 304
      ctx.status = 304;
    }
    return data;
  }
}
