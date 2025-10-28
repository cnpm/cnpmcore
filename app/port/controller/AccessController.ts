import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
} from 'egg';
import { ForbiddenError, NotFoundError } from 'egg/errors';

import { AbstractController } from './AbstractController.ts';
import {
  FULLNAME_REG_STRING,
  getFullname,
  getScopeAndName,
} from '../../common/PackageUtil.ts';
import { PackageAccessLevel } from '../../common/constants.ts';

@HTTPController()
export class AccessController extends AbstractController {
  @HTTPMethod({
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/collaborators`,
    method: HTTPMethodEnum.GET,
  })
  async listCollaborators(@HTTPParam() fullname: string) {
    const [scope, name] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    // return 403 if pkg not exists
    if (!pkg) {
      throw new ForbiddenError('Forbidden');
    }

    const maintainers = await this.packageRepository.listPackageMaintainers(
      pkg.packageId
    );
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
  async listPackagesByUser(@HTTPParam() username: string) {
    const user = await this.userRepository.findUserByName(username);
    if (!user) {
      throw new NotFoundError(`User "${username}" not found`);
    }

    const pkgs = await this.packageRepository.listPackagesByUserId(user.userId);
    const res: Record<string, string> = {};
    for (const pkg of pkgs) {
      res[getFullname(pkg.scope, pkg.name)] = PackageAccessLevel.write;
    }

    return res;
  }
}
