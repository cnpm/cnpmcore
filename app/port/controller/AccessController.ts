import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING, getFullname, getScopeAndName } from '../../common/PackageUtil';
import { PackageAccessLevel } from '../../common/constants';
import { ForbiddenError, NotFoundError } from 'egg-errors';

@HTTPController()
export class AccessController extends AbstractController {
  @HTTPMethod({
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/collaborators`,
    method: HTTPMethodEnum.GET,
  })
  async listCollaborators(@HTTPParam() fullname: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    // return 403 if pkg not exists
    if (!pkg) {
      throw new ForbiddenError('Forbidden');
    }

    const maintainers = await this.packageRepository.listPackageMaintainers(pkg!.packageId);
    const res: Record<string, string> = {};
    maintainers.forEach(maintainer => {
      res[maintainer.displayName] = PackageAccessLevel.write;
    });

    return res;
  }

  @HTTPMethod({
    path: `/-/org/:username/package`,
    method: HTTPMethodEnum.GET,
  })
  async listPackagesByUser(@HTTPParam() username: string) {
    const user = await this.userRepository.findUserByName(username);
    if (!user) {
      throw new NotFoundError(`User "${username}" not found`);
    }

    const pkgs = await this.packageRepository.listPackagesByUserId(user.userId);
    const res: Record<string, string> = {};
    pkgs.forEach(pkg => {
      res[getFullname(pkg.scope, pkg.name)] = PackageAccessLevel.write;
    });

    return res;
  }


}
