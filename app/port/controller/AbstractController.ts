import {
  NotFoundError,
  UnavailableForLegalReasonsError,
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
import {
  VersionRule,
} from '../typebox';

class PackageNotFoundError extends NotFoundError {}

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
    return this.config.cnpmcore.syncMode === 'all' || this.config.cnpmcore.syncMode === 'exist';
  }

  protected isPrivateScope(scope: string) {
    return scope && this.config.cnpmcore.allowScopes.includes(scope);
  }

  protected async ensurePublishAccess(ctx: EggContext, fullname: string) {
    await this.userRoleManager.checkPublishAccess(ctx, fullname);
    const pkg = await this.getPackageEntityByFullname(fullname);
    if (!pkg) {
      throw this.createPackageNotFoundError(fullname);
    }
    return pkg;
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

  protected createPackageNotFoundError(fullname: string, version?: string, allowSync = false) {
    const message = version ? `${fullname}@${version} not found` : `${fullname} not found`;
    const err = new PackageNotFoundError(message);
    const [ scope ] = getScopeAndName(fullname);
    // dont sync private scope
    if (!this.isPrivateScope(scope)) {
      // syncMode = none, redirect public package to source registry
      if (!this.enableSync) {
        err.redirectToSourceRegistry = this.sourceRegistry;
      // syncMode = all/exist
      } else {
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

  protected createPackageBlockError(reason: string, fullname: string, version?: string) {
    const message = version ? `${fullname}@${version} was blocked` : `${fullname} was blocked`;
    return new UnavailableForLegalReasonsError(`${message}, reason: ${reason}`);
  }

  protected async getPackageEntityByFullname(fullname: string): Promise<PackageEntity> {
    const [ scope, name ] = getScopeAndName(fullname);
    return await this.getPackageEntity(scope, name);
  }

  // try to get package entity, throw NotFoundError when package not exists
  protected async getPackageEntity(scope: string, name: string): Promise<PackageEntity> {
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (!packageEntity) {
      const fullname = getFullname(scope, name);
      throw this.createPackageNotFoundError(fullname);
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

  protected getAndCheckVersionFromFilename(ctx: EggContext, fullname: string, filenameWithVersion: string) {
    const scopeAndName = getScopeAndName(fullname);
    const name = scopeAndName[1];
    // @foo/bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    // bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    const version = filenameWithVersion.substring(name.length + 1);
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
