import {
  NotFoundError,
} from 'egg-errors';
import {
  Inject,
  EggContext,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggAppConfig,
} from 'egg';
import { MiddlewareController } from '../middleware';
import { UserRoleManager } from '../UserRoleManager';
import { PackageRepository } from '../../repository/PackageRepository';
import { UserRepository } from '../../repository/UserRepository';
import { getFullname, getScopeAndName } from '../../common/PackageUtil';
import { Package as PackageEntity } from '../../core/entity/Package';
import { PackageVersion as PackageVersionEntity } from '../../core/entity/PackageVersion';
import { UserService } from '../../core/service/UserService';

export abstract class AbstractController extends MiddlewareController {
  @Inject()
  protected logger: EggLogger;
  @Inject()
  protected config: EggAppConfig;
  @Inject()
  protected userRoleManager: UserRoleManager;
  @Inject()
  protected packageRepository: PackageRepository;
  @Inject()
  protected userRepository: UserRepository;
  @Inject()
  protected userService: UserService;

  protected async getPackageEntityByFullname(fullname: string): Promise<PackageEntity> {
    const [ scope, name ] = getScopeAndName(fullname);
    return await this.getPackageEntity(scope, name);
  }

  // 1. get package
  // 2. check current user is maintainer
  // 3. make sure current token can publish
  protected async getPackageEntityAndRequiredMaintainer(ctx: EggContext, fullname: string): Promise<PackageEntity> {
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.getPackageEntity(scope, name);
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
    await this.userRoleManager.requiredPackageMaintainer(pkg, authorizedUser);
    return pkg;
  }

  // try to get package entity, throw NotFoundError when package not exists
  protected async getPackageEntity(scope: string, name: string): Promise<PackageEntity> {
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (!packageEntity) {
      const fullname = getFullname(scope, name);
      throw new NotFoundError(`${fullname} not found`);
    }
    return packageEntity;
  }

  protected async getPackageVersionEntity(pkg: PackageEntity, version: string): Promise<PackageVersionEntity> {
    const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
    if (!packageVersion) {
      throw new NotFoundError(`${pkg.fullname}@${version} not found`);
    }
    return packageVersion;
  }
}
