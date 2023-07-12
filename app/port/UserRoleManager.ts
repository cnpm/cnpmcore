import {
  AccessLevel,
  Inject,
  EggContext,
  ContextProto,
} from '@eggjs/tegg';
import { EggAppConfig, EggLogger } from 'egg';
import { UnauthorizedError, ForbiddenError } from 'egg-errors';
import { PackageRepository } from '../repository/PackageRepository';
import { Package as PackageEntity } from '../core/entity/Package';
import { User as UserEntity } from '../core/entity/User';
import { Token as TokenEntity } from '../core/entity/Token';
import { getScopeAndName } from '../common/PackageUtil';
import { RegistryManagerService } from '../core/service/RegistryManagerService';
import { TokenService } from '../core/service/TokenService';

// https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-tokens-on-the-website
export type TokenRole = 'read' | 'publish' | 'setting';

@ContextProto({
  // only inject on port module
  accessLevel: AccessLevel.PRIVATE,
})
export class UserRoleManager {
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly config: EggAppConfig;
  @Inject()
  protected logger: EggLogger;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly tokenService: TokenService;

  private handleAuthorized = false;
  private currentAuthorizedUser: UserEntity;
  private currentAuthorizedToken: TokenEntity;

  // check publish access
  // 1. admin has all access
  // 2. has published in current registry
  // 3. pkg scope is allowed to publish
  // use AbstractController#ensurePublishAccess ensure pkg exists;
  public async checkPublishAccess(ctx: EggContext, fullname: string) {

    const user = await this.requiredAuthorizedUser(ctx, 'publish');

    // 1. admin has all access
    const isAdmin = await this.isAdmin(ctx);
    if (isAdmin) {
      return user;
    }

    // 2. check for checkGranularTokenAccess
    const authorizedUserAndToken = await this.getAuthorizedUserAndToken(ctx);
    const { token } = authorizedUserAndToken!;
    await this.tokenService.checkGranularTokenAccess(token, fullname);

    // 3. has published in current registry
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    const selfRegistry = await this.registryManagerService.ensureSelfRegistry();
    const inSelfRegistry = pkg?.registryId === selfRegistry.registryId;
    if (inSelfRegistry) {
      // 3.1 check in Maintainers table
      // Higher priority than scope check
      await this.requiredPackageMaintainer(pkg, user);
      return user;
    }

    if (pkg && !scope && !inSelfRegistry) {
      // 3.2 public package can't publish in other registry
      // scope package can be migrated into self registry
      throw new ForbiddenError(`Can\'t modify npm public package "${fullname}"`);
    }

    // 4 check scope is allowed to publish
    await this.requiredPackageScope(scope, user);
    if (pkg) {
      // published scoped package
      await this.requiredPackageMaintainer(pkg!, user);
    }

    return user;
  }

  // {
  //   'user-agent': 'npm/8.1.2 node/v16.13.1 darwin arm64 workspaces/false',
  //   'npm-command': 'adduser',
  //   authorization: 'Bearer 379f84d8-ba98-480b-909e-a8260af3a3ee',
  //   'content-type': 'application/json',
  //   accept: '*/*',
  //   'content-length': '166',
  //   'accept-encoding': 'gzip,deflate',
  //   host: 'localhost:7001',
  //   connection: 'keep-alive'
  // }
  public async getAuthorizedUserAndToken(ctx: EggContext) {
    if (this.handleAuthorized) {
      if (!this.currentAuthorizedUser) return null;
      return {
        token: this.currentAuthorizedToken,
        user: this.currentAuthorizedUser,
      };
    }
    this.handleAuthorized = true;
    const authorization = ctx.get('authorization');
    if (!authorization) return null;
    const authorizedUserAndToken = await this.tokenService.getUserAndToken(authorization);
    if (!authorizedUserAndToken) {
      return null;
    }

    // check token expired & set lastUsedAt
    await this.tokenService.checkTokenStatus(authorizedUserAndToken.token);
    this.currentAuthorizedToken = authorizedUserAndToken.token;
    this.currentAuthorizedUser = authorizedUserAndToken.user;
    ctx.userId = authorizedUserAndToken.user.userId;
    return authorizedUserAndToken;
  }

  public async requiredAuthorizedUser(ctx: EggContext, role: TokenRole) {
    const authorizedUserAndToken = await this.getAuthorizedUserAndToken(ctx);
    if (!authorizedUserAndToken) {
      const authorization = ctx.get('authorization');
      const message = authorization ? 'Invalid token' : 'Login first';
      throw new UnauthorizedError(message);
    }
    const { user, token } = authorizedUserAndToken;
    // only enable npm client and version check setting will go into this condition
    if (this.config.cnpmcore.enableNpmClientAndVersionCheck && role === 'publish') {
      if (token.isReadonly) {
        throw new ForbiddenError(`Read-only Token "${token.tokenMark}" can't publish`);
      }
      // only support npm >= 7.0.0 allow publish action
      // user-agent: "npm/6.14.12 node/v10.24.1 darwin x64"
      const m = /\bnpm\/(\d{1,5})\./.exec(ctx.get('user-agent'));
      if (!m) {
        throw new ForbiddenError('Only allow npm client to access');
      }
      const major = parseInt(m[1]);
      if (major < 7) {
        throw new ForbiddenError('Only allow npm@>=7.0.0 client to access');
      }
    }
    if (role === 'setting') {
      if (token.isReadonly) {
        throw new ForbiddenError(`Read-only Token "${token.tokenMark}" can't setting`);
      }
      if (token.isAutomation) {
        throw new ForbiddenError(`Automation Token "${token.tokenMark}" can't setting`);
      }
    }
    return user;
  }

  public async requiredPackageMaintainer(pkg: PackageEntity, user: UserEntity) {

    const maintainers = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    const maintainer = maintainers.find(m => m.userId === user.userId);
    if (!maintainer) {
      const names = maintainers.map(m => m.name).join(', ');
      throw new ForbiddenError(`"${user.name}" not authorized to modify ${pkg.fullname}, please contact maintainers: "${names}"`);
    }
  }

  public async requiredPackageScope(scope: string, user: UserEntity) {
    const cnpmcoreConfig = this.config.cnpmcore;
    if (cnpmcoreConfig.allowPublishNonScopePackage) {
      return;
    }
    const allowScopes = user.scopes ?? cnpmcoreConfig.allowScopes;
    if (!scope) {
      throw new ForbiddenError(`Package scope required, legal scopes: "${allowScopes.join(', ')}"`);
    }
    if (!allowScopes.includes(scope)) {
      throw new ForbiddenError(`Scope "${scope}" not match legal scopes: "${allowScopes.join(', ')}"`);
    }
  }

  public async isAdmin(ctx: EggContext) {
    const authorizedUserAndToken = await this.getAuthorizedUserAndToken(ctx);
    if (!authorizedUserAndToken) return false;
    const { user, token } = authorizedUserAndToken;
    if (token.isReadonly) return false;
    return user.name in this.config.cnpmcore.admins;
  }
}
