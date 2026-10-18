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
    await this.userRoleManager.checkReadAccess(ctx, scope, name);

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
    for (const pkg of pkgs) {
      try {
        // Omit team-private packages the caller cannot read (same policy as manifests).
        await this.userRoleManager.checkReadAccess(ctx, pkg.scope, pkg.name);
      } catch (err) {
        if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
          continue;
        }
        throw err;
      }
      res[getFullname(pkg.scope, pkg.name)] = PackageAccessLevel.write;
    }

    return res;
  }
}
