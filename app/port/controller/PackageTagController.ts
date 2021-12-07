import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';

@HTTPController()
export class PackageTagController extends AbstractController {
  @HTTPMethod({
    // GET /-/package/:fullname/dist-tags
    // e.g.: https://registry.npmjs.com/-/package/koa/dist-tags
    // {"latest":"2.13.4","next":"2.9.0","v1":"1.7.0","latest-0":"0.21.1"}
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/dist-tags`,
    method: HTTPMethodEnum.GET,
  })
  async showTags(@HTTPParam() fullname: string) {
    const packageEntity = await this.getPackageEntityByFullname(fullname);
    const tagEntities = await this.packageRepository.listPackageTags(packageEntity.packageId);
    const tags = {};
    for (const entity of tagEntities) {
      tags[entity.tag] = entity.version;
    }
    return tags;
  }

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#update-a-packages-tag
  @HTTPMethod({
    // PUT /:fullname/:tag
    path: `/:fullname(${FULLNAME_REG_STRING})/:tag`,
    method: HTTPMethodEnum.PUT,
  })
  async updateTag(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() version: string) {
    console.log(fullname, version, ctx.headers, ctx.href);
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
    console.log(authorizedUser);
  }
}
