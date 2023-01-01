import {
  AccessLevel,
  SingletonProto,
  Inject,
  EggContext,
} from '@eggjs/tegg';
import { EggAppConfig, EggLogger } from 'egg';
import { UnauthorizedError, ForbiddenError } from 'egg-errors';
import { UserRepository } from '../repository/UserRepository';
import { PackageRepository } from '../repository/PackageRepository';
import { Package as PackageEntity } from '../core/entity/Package';
import { User as UserEntity } from '../core/entity/User';
import { Token as TokenEntity } from '../core/entity/Token';
import { sha512 } from '../common/UserUtil';

// https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-tokens-on-the-website
export type TokenRole = 'read' | 'publish' | 'setting';

@SingletonProto({
  // only inject on port module
  accessLevel: AccessLevel.PRIVATE,
})
export class UserRoleManager {
  @Inject()
  private readonly userRepository: UserRepository;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly config: EggAppConfig;
  @Inject()
  protected logger: EggLogger;

  private handleAuthorized = false;
  private currentAuthorizedUser: UserEntity;
  private currentAuthorizedToken: TokenEntity;

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
    const matchs = /^Bearer ([\w\.]+?)$/.exec(authorization);
    if (!matchs) return null;
    const tokenValue = matchs[1];
    const tokenKey = sha512(tokenValue);
    const authorizedUserAndToken = await this.userRepository.findUserAndTokenByTokenKey(tokenKey);
    if (authorizedUserAndToken) {
      this.currentAuthorizedToken = authorizedUserAndToken.token;
      this.currentAuthorizedUser = authorizedUserAndToken.user;
      ctx.userId = authorizedUserAndToken.user.userId;
    }
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
    // should be private package
    if (!pkg.isPrivate) {
      // admins can modified public package
      if (this.config.cnpmcore.admins[user.name]) {
        this.logger.warn('[UserRoleManager.requiredPackageMaintainer] admin "%s" modified public package "%s"',
          user.name, pkg.fullname);
        return;
      }
      throw new ForbiddenError(`Can\'t modify npm public package "${pkg.fullname}"`);
    }

    // admins can modified private package (publish to cnpmcore)
    if (pkg.isPrivate && this.config.cnpmcore.admins[user.name] === user.email) {
      this.logger.warn('[UserRoleManager.requiredPackageMaintainer] admin "%s" modified private package "%s"',
        user.name, pkg.fullname);
      return;
    }

    const maintainers = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    const maintainer = maintainers.find(m => m.userId === user.userId);
    if (!maintainer) {
      const names = maintainers.map(m => m.name).join(', ');
      throw new ForbiddenError(`"${user.name}" not authorized to modify ${pkg.fullname}, please contact maintainers: "${names}"`);
    }
  }

  public async requiredPackageScope(scope: string, user: UserEntity) {
    const cnpmcoreConfig = this.config.cnpmcore;
    if (!cnpmcoreConfig.allowPublishNonScopePackage) {
      const allowScopes = user.scopes ?? cnpmcoreConfig.allowScopes;
      if (!scope) {
        throw new ForbiddenError(`Package scope required, legal scopes: "${allowScopes.join(', ')}"`);
      }
      if (!allowScopes.includes(scope)) {
        throw new ForbiddenError(`Scope "${scope}" not match legal scopes: "${allowScopes.join(', ')}"`);
      }
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
