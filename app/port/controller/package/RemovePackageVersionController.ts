import {
  BadRequestError,
  ForbiddenError,
} from 'egg-errors';
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
import { FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';

@HTTPController()
export class RemovePackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  // https://github.com/npm/cli/blob/latest/lib/commands/unpublish.js#L101
  // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L43
  @HTTPMethod({
    // DELETE /@cnpm/foo/-/foo-4.0.0.tgz/-rev/61af62d6295fcbd9f8f1c08f
    // DELETE /:fullname/-/:filenameWithVersion.tgz/-rev/:rev
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz/-rev/:rev`,
    method: HTTPMethodEnum.DELETE,
  })
  async remove(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    const npmCommand = ctx.get('npm-command');
    if (npmCommand !== 'unpublish') {
      throw new BadRequestError('Only allow "unpublish" npm-command');
    }
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg!;
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    // https://docs.npmjs.com/policies/unpublish
    // can unpublish anytime within the first 72 hours after publishing
    if (pkg.isPrivate && Date.now() - packageVersion.publishTime.getTime() >= 3600000 * 72) {
      throw new ForbiddenError(`${pkg.fullname}@${version} unpublish is not allowed after 72 hours of released`);
    }
    ctx.logger.info('[PackageController:removeVersion] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    await this.packageManagerService.removePackageVersion(pkg, packageVersion);
    return { ok: true };
  }
}
