import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import { Type } from '@sinclair/typebox';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';
import { PackageManagerService } from '../../core/service/PackageManagerService';

const TagRule = Type.RegEx(/^[a-zA-Z]/);

@HTTPController()
export class PackageTagController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

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
  // cli: https://github.com/npm/cli/blob/latest/lib/commands/dist-tag.js#L103
  @HTTPMethod({
    // PUT /-/package/:fullname/dist-tags/:tag
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/dist-tags/:tag`,
    method: HTTPMethodEnum.PUT,
  })
  async saveTag(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() tag: string, @HTTPBody() version: string) {
    this.checkPackageVersionFormat(version);
    ctx.tValidate(TagRule, tag);
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
    const pkg = await this.getPackageEntityByFullname(fullname);
    await this.userRoleManager.requiredPackageMaintainer(pkg, authorizedUser);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    await this.packageManagerService.savePackageTag(pkg, tag, packageVersion.version);
    return { ok: true };
  }
}
