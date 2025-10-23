import { BadRequestError, ForbiddenError } from 'egg-errors';
import {
  type EggContext,
  Context,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';

import { AbstractController } from '../AbstractController.ts';
import { FULLNAME_REG_STRING } from '../../../common/PackageUtil.ts';
import type { PackageManagerService } from '../../../core/service/PackageManagerService.ts';
import type { Package } from '../../../core/entity/Package.ts';
import type { PackageVersion } from '../../../core/entity/PackageVersion.ts';

@HTTPController()
export class RemovePackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  // https://github.com/npm/cli/blob/latest/lib/commands/unpublish.js#L101
  // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L84
  // await npmFetch(`${tarballUrl}/-rev/${_rev}`, {
  //   ...opts,
  //   method: 'DELETE',
  //   ignoreBody: true,
  // })
  @HTTPMethod({
    // DELETE /@cnpm/foo/-/foo-4.0.0.tgz/-rev/61af62d6295fcbd9f8f1c08f
    // DELETE /:fullname/-/:filenameWithVersion.tgz/-rev/:rev
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz/-rev/:rev`,
    method: HTTPMethodEnum.DELETE,
  })
  async removeByTarballUrl(
    @HTTPContext() ctx: EggContext,
    @HTTPParam() fullname: string,
    @HTTPParam() filenameWithVersion: string
  ) {
    const npmCommand = ctx.get('npm-command');
    if (npmCommand !== 'unpublish') {
      throw new BadRequestError('Only allow "unpublish" npm-command');
    }
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg;
    const version = this.getAndCheckVersionFromFilename(
      ctx,
      fullname,
      filenameWithVersion
    );
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    await this.#removePackageVersion(pkg, packageVersion);
    return { ok: true };
  }

  // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L43
  // npm http fetch DELETE 404 http://localhost:62649/@cnpm%2ffoo/-rev/1-642f6e8b52d7b8eb03aef23f
  // await npmFetch(`${pkgUri}/-rev/${pkg._rev}`, {
  //   ...opts,
  //   method: 'DELETE',
  //   ignoreBody: true,
  // })
  @HTTPMethod({
    // DELETE /@cnpm/foo/-rev/61af62d6295fcbd9f8f1c08f
    // DELETE /:fullname/-rev/:rev
    path: `/:fullname(${FULLNAME_REG_STRING})/-rev/:rev`,
    method: HTTPMethodEnum.DELETE,
  })
  async removeByPkgUri(
    @HTTPContext() ctx: EggContext,
    @HTTPParam() fullname: string
  ) {
    const npmCommand = ctx.get('npm-command');
    if (npmCommand !== 'unpublish') {
      throw new BadRequestError('Only allow "unpublish" npm-command');
    }
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg;
    // try to remove the latest version first
    const packageTag = await this.packageRepository.findPackageTag(
      pkg.packageId,
      'latest'
    );
    let packageVersion: PackageVersion | null = null;
    if (packageTag) {
      packageVersion = await this.packageRepository.findPackageVersion(
        pkg.packageId,
        packageTag.version
      );
    }
    if (packageVersion) {
      await this.#removePackageVersion(pkg, packageVersion);
    } else {
      this.logger.info(
        '[PackageController:unpublishPackage] %s, packageId: %s',
        pkg.fullname,
        pkg.packageId
      );
      await this.packageManagerService.unpublishPackage(pkg);
    }
    return { ok: true };
  }

  async #removePackageVersion(pkg: Package, packageVersion: PackageVersion) {
    // https://docs.npmjs.com/policies/unpublish
    // can unpublish anytime within the first 72 hours after publishing
    if (
      pkg.isPrivate &&
      Date.now() - packageVersion.publishTime.getTime() >= 3_600_000 * 72
    ) {
      throw new ForbiddenError(
        `${pkg.fullname}@${packageVersion.version} unpublish is not allowed after 72 hours of released`
      );
    }
    this.logger.info(
      '[PackageController:removeVersion] %s@%s, packageVersionId: %s',
      pkg.fullname,
      packageVersion.version,
      packageVersion.packageVersionId
    );
    await this.packageManagerService.removePackageVersion(pkg, packageVersion);
  }
}
