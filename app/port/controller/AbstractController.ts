import { NotFoundError, UnavailableForLegalReasonsError } from 'egg-errors';
import { type EggContext, Inject } from '@eggjs/tegg';
import type { EggAppConfig, EggLogger } from 'egg';

import { MiddlewareController } from '../middleware/index.js';
import type { UserRoleManager } from '../UserRoleManager.js';
import type { PackageRepository } from '../../repository/PackageRepository.js';
import type { UserRepository } from '../../repository/UserRepository.js';
import { getFullname, getScopeAndName } from '../../common/PackageUtil.js';
import type { Package as PackageEntity } from '../../core/entity/Package.js';
import type { PackageVersion as PackageVersionEntity } from '../../core/entity/PackageVersion.js';
import type { UserService } from '../../core/service/UserService.js';
import type { User as UserEntity } from '../../core/entity/User.js';
import { VersionRule } from '../typebox.js';
import { SyncMode } from '../../common/constants.js';

class PackageNotFoundError extends NotFoundError {
  redirectToSourceRegistry?: string;
}

class ControllerRedirectError extends NotFoundError {
  location: string;
  constructor(location: string) {
    super();
    this.location = location;
  }
}

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

  protected get sourceRegistry(): string {
    return this.config.cnpmcore.sourceRegistry;
  }

  protected get enableSync() {
    return this.config.cnpmcore.syncMode !== SyncMode.none;
  }

  protected isPrivateScope(scope: string) {
    return scope && this.config.cnpmcore.allowScopes.includes(scope);
  }

  protected async ensurePublishAccess<C extends boolean>(
    ctx: EggContext,
    fullname: string,
    checkPkgExist: C = true as C
  ): Promise<{
    pkg: C extends true ? PackageEntity : undefined;
    user: UserEntity;
  }> {
    const user = await this.userRoleManager.checkPublishAccess(ctx, fullname);
    if (!checkPkgExist) {
      // @ts-expect-error checkPkgExist is false, pkg is undefined
      return {
        user,
      };
    }
    const [scope, name] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      throw this.createPackageNotFoundError(fullname);
    }
    return {
      // @ts-expect-error pkg exists
      pkg,
      user,
    };
  }

  protected get syncNotFound() {
    return this.config.cnpmcore.syncNotFound;
  }

  protected get redirectNotFound() {
    return this.config.cnpmcore.redirectNotFound;
  }

  protected getAllowSync(ctx: EggContext): boolean {
    let allowSync = false;

    // request not by node, consider it request from web, don't sync
    const ua = ctx.get('user-agent');
    if (!ua || !ua.includes('node')) {
      return allowSync;
    }

    // if request with `/xxx?write=true`, meaning the read request using for write, don't sync
    if (ctx.query.write) {
      return allowSync;
    }

    allowSync = true;
    return allowSync;
  }

  protected createControllerRedirectError(location: string) {
    return new ControllerRedirectError(location);
  }

  protected createPackageNotFoundError(fullname: string, version?: string) {
    const message = version
      ? `${fullname}@${version} not found`
      : `${fullname} not found`;
    return new PackageNotFoundError(message);
  }

  protected createPackageNotFoundErrorWithRedirect(
    fullname: string,
    version?: string,
    allowSync = false
  ) {
    // const err = new PackageNotFoundError(message);
    const err = this.createPackageNotFoundError(fullname, version);
    const [scope] = getScopeAndName(fullname);
    // don't sync private scope
    if (!this.isPrivateScope(scope)) {
      // syncMode = none/admin, redirect public package to source registry
      if (
        !this.enableSync &&
        this.config.cnpmcore.syncMode !== SyncMode.admin
      ) {
        if (this.redirectNotFound) {
          err.redirectToSourceRegistry = this.sourceRegistry;
        }
      } else {
        // syncMode = all/exist
        if (allowSync && this.syncNotFound) {
          // ErrorHandler will use syncPackage to create sync task
          err.syncPackage = {
            fullname,
          };
        }
        if (allowSync && this.redirectNotFound) {
          // redirect when package not found
          err.redirectToSourceRegistry = this.sourceRegistry;
        }
      }
    }
    return err;
  }

  protected createPackageBlockError(
    reason: string,
    fullname: string,
    version?: string
  ) {
    const message = version
      ? `${fullname}@${version} was blocked`
      : `${fullname} was blocked`;
    return new UnavailableForLegalReasonsError(`${message}, reason: ${reason}`);
  }

  protected async getPackageEntityByFullname(
    fullname: string,
    allowSync?: boolean
  ): Promise<PackageEntity> {
    const [scope, name] = getScopeAndName(fullname);
    return await this.getPackageEntity(scope, name, allowSync);
  }

  // try to get package entity, throw NotFoundError when package not exists
  protected async getPackageEntity(
    scope: string,
    name: string,
    allowSync?: boolean
  ): Promise<PackageEntity> {
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (!packageEntity) {
      const fullname = getFullname(scope, name);
      throw this.createPackageNotFoundErrorWithRedirect(
        fullname,
        undefined,
        allowSync
      );
    }
    return packageEntity;
  }

  protected async getPackageVersionEntity(
    pkg: PackageEntity,
    version: string,
    allowSync?: boolean
  ): Promise<PackageVersionEntity> {
    const packageVersion = await this.packageRepository.findPackageVersion(
      pkg.packageId,
      version
    );
    if (!packageVersion) {
      throw this.createPackageNotFoundErrorWithRedirect(
        pkg.fullname,
        version,
        allowSync
      );
    }
    return packageVersion;
  }

  protected getAndCheckVersionFromFilename(
    ctx: EggContext,
    fullname: string,
    filenameWithVersion: string
  ) {
    const scopeAndName = getScopeAndName(fullname);
    const name = scopeAndName[1];
    // @foo/bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    // bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    const version = filenameWithVersion.slice(name.length + 1);
    // check version format
    const data = { version };
    ctx.tValidate(VersionRule, data);
    return data.version;
  }

  protected setCDNHeaders(ctx: EggContext) {
    const config = this.config.cnpmcore;
    if (config.enableCDN) {
      ctx.set('cache-control', config.cdnCacheControlHeader);
      ctx.vary(config.cdnVaryHeader);
    }
  }
}
