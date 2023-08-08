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
import { ForbiddenError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';
import { PackageManagerService } from '../../core/service/PackageManagerService';
import { TagRule, TagWithVersionRule } from '../typebox';

@HTTPController()
export class PackageTagController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /-/package/:fullname/dist-tags
    // e.g.: https://registry.npmjs.org/-/package/koa/dist-tags
    // {"latest":"2.13.4","next":"2.9.0","v1":"1.7.0","latest-0":"0.21.1"}
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/dist-tags`,
    method: HTTPMethodEnum.GET,
  })
  async showTags(@HTTPParam() fullname: string) {
    const packageEntity = await this.getPackageEntityByFullname(fullname);
    const tagEntities = await this.packageRepository.listPackageTags(packageEntity.packageId);
    const tags: Record<string, string> = {};
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
    const data = { tag, version };
    ctx.tValidate(TagWithVersionRule, data);
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg!;
    const packageVersion = await this.getPackageVersionEntity(pkg, data.version);
    await this.packageManagerService.savePackageTag(pkg, data.tag, packageVersion.version);
    return { ok: true };
  }

  // https://github.com/npm/cli/blob/latest/lib/commands/dist-tag.js#L134
  @HTTPMethod({
    // DELETE /-/package/:fullname/dist-tags/:tag
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/dist-tags/:tag`,
    method: HTTPMethodEnum.DELETE,
  })
  async removeTag(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() tag: string) {
    const data = { tag };
    ctx.tValidate(TagRule, data);
    if (tag === 'latest') {
      throw new ForbiddenError('Can\'t remove the "latest" tag');
    }
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg!;
    await this.packageManagerService.removePackageTag(pkg, data.tag);
    return { ok: true };
  }
}
