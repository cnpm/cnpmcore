import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';

import { PackageRepository } from '../repository/PackageRepository';
import { Package as PackageEntity } from '../core/entity/Package';
import { User as UserEntity } from '../core/entity/User';

@ContextProto({
  // only inject on port module
  accessLevel: AccessLevel.PRIVATE,
})
export class RoleManager {
  @Inject()
  private readonly packageRepository: PackageRepository;

  public async requiredPackageMaintainer(pkg: PackageEntity, user: UserEntity) {
    const maintainers = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    const maintainer = maintainers.find(m => m.userId === user.userId);
    if (!maintainer) {
      const names = maintainers.map(m => m.name).join(', ');
      throw new ForbiddenError(`'${user.name}' not authorized to modify ${pkg.fullname}, please contact maintainers: '${names}'`);
    }
  }
}
