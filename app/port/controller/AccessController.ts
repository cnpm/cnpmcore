import { Context, HTTPContext, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam } from 'egg';
import { ForbiddenError, NotFoundError, UnauthorizedError } from 'egg/errors';

import { PackageAccessLevel } from '../../common/constants.ts';
import { FULLNAME_REG_STRING, getFullname, getScopeAndName } from '../../common/PackageUtil.ts';
import { AbstractController } from './AbstractController.ts';

@HTTPController()
export class AccessController extends AbstractController {
  @HTTPMethod({
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/collaborators`,
    method: HTTPMethodEnum.GET,
  })
  async listCollaborators(@HTTPContext() ctx: Context, @HTTPParam() fullname: string) {
    const [scope, name] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    // return 403 if pkg not exists
    if (!pkg) {
      throw new ForbiddenError('Forbidden');
    }
    const isTeamBound = await this.userRoleManager.checkReadAccess(ctx, scope, name).catch((err) => {
      // same generic response as a missing package
      throw err instanceof ForbiddenError || err instanceof UnauthorizedError ? new ForbiddenError('Forbidden') : err;
    });
    if (isTeamBound) {
      ctx.set('cache-control', 'private, no-store');
    }

    const maintainers = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    const res: Record<string, string> = {};
    for (const maintainer of maintainers) {
      res[maintainer.displayName] = PackageAccessLevel.write;
    }

    return res;
  }

  @HTTPMethod({
    path: '/-/org/:username/package',
    method: HTTPMethodEnum.GET,
  })
  async listPackagesByUser(@HTTPContext() ctx: Context, @HTTPParam() username: string) {
    const user = await this.userRepository.findUserByName(username);
    if (!user) {
      throw new NotFoundError(`User "${username}" not found`);
    }

    const pkgs = await this.packageRepository.listPackagesByUserId(user.userId);
    const res: Record<string, string> = {};
    // Omit team-private packages the caller cannot read (same policy as manifests).
    const { readable, hasTeamBound } = await this.userRoleManager.filterReadablePackages(ctx, pkgs);
    if (hasTeamBound) {
      ctx.set('cache-control', 'private, no-store');
    }
    for (const pkg of readable) {
      res[getFullname(pkg.scope, pkg.name)] = PackageAccessLevel.write;
    }

    return res;
  }
}
