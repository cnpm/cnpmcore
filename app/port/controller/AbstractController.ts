import {
  UnprocessableEntityError,
  NotFoundError,
  UnauthorizedError,
} from 'egg-errors';
import {
  Inject,
  EggContext,
} from '@eggjs/tegg';
import {
  EggLogger,
} from 'egg';
import * as semver from 'semver';
import { MiddlewareController } from '../middleware';
import { RoleManager } from '../RoleManager';
import { PackageRepository } from '../../repository/PackageRepository';
import { UserRepository } from '../../repository/UserRepository';
import { UserService } from '../../core/service/UserService';
import { getFullname, getScopeAndName } from '../../common/PackageUtil';
import { sha512 } from '../../common/UserUtil';
import { Package as PackageEntity } from '../../core/entity/Package';
import { PackageVersion as PackageVersionEntity } from '../../core/entity/PackageVersion';

// https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-tokens-on-the-website
type TokenRole = 'read' | 'publish' | 'setting';

export abstract class AbstractController extends MiddlewareController {
  @Inject()
  protected logger: EggLogger;
  @Inject()
  protected roleManager: RoleManager;
  @Inject()
  protected packageRepository: PackageRepository;
  @Inject()
  protected userRepository: UserRepository;
  @Inject()
  protected userService: UserService;

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
  protected async getAuthorizedUserAndToken(ctx: EggContext) {
    const authorization = ctx.get('authorization');
    if (!authorization) return null;
    const matchs = /^Bearer ([\w\.]+?)$/.exec(authorization);
    if (!matchs) return null;
    const tokenValue = matchs[1];
    const tokenKey = sha512(tokenValue);
    return await this.userRepository.findUserAndTokenByTokenKey(tokenKey);
  }

  protected async requiredAuthorizedUser(ctx: EggContext, role: TokenRole) {
    const authorizedUserAndToken = await this.getAuthorizedUserAndToken(ctx);
    if (!authorizedUserAndToken) {
      const authorization = ctx.get('authorization');
      const message = authorization ? 'Invalid token' : 'Login first';
      throw new UnauthorizedError(message);
    }
    const { user, token } = authorizedUserAndToken;
    if (role === 'publish') {
      if (token.isReadonly) {
        throw new UnauthorizedError(`Read-only Token '${token.tokenMark}' can't publish`);
      }
    }
    if (role === 'setting') {
      if (token.isReadonly) {
        throw new UnauthorizedError(`Read-only Token '${token.tokenMark}' can't setting`);
      }
      if (token.isAutomation) {
        throw new UnauthorizedError(`Automation Token '${token.tokenMark}' can't setting`);
      }
    }
    return user;
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

  protected checkPackageVersionFormat(version: string) {
    if (!semver.valid(version)) {
      throw new UnprocessableEntityError(`version(${JSON.stringify(version)}) format invalid`);
    }
  }
}
