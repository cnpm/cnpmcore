import dayjs from 'dayjs';
import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { isEmpty } from 'lodash-es';
import { ForbiddenError, UnauthorizedError } from 'egg-errors';
import { AbstractService } from '../../common/AbstractService.js';
import type { Token } from '../entity/Token.js';
import { isGranularToken } from '../entity/Token.js';
import type { TokenPackage as TokenPackageModel } from '../../../app/repository/model/TokenPackage.js';
import type { Package as PackageModel } from '../../../app/repository/model/Package.js';
import { ModelConvertor } from '../../../app/repository/util/ModelConvertor.js';
import { Package as PackageEntity } from '../entity/Package.js';
import { getScopeAndName } from '../../../app/common/PackageUtil.js';
import { sha512 } from '../../../app/common/UserUtil.js';
import type { UserRepository } from '../../../app/repository/UserRepository.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TokenService extends AbstractService {
  @Inject()
  private readonly TokenPackage: typeof TokenPackageModel;
  @Inject()
  private readonly Package: typeof PackageModel;
  @Inject()
  private readonly userRepository: UserRepository;

  public async listTokenPackages(token: Token) {
    if (isGranularToken(token)) {
      const models = await this.TokenPackage.find({ tokenId: token.tokenId });
      const packages = await this.Package.find({
        packageId: models.map(m => m.packageId),
      });
      return packages.map(pkg =>
        ModelConvertor.convertModelToEntity(pkg, PackageEntity)
      );
    }
    return null;
  }

  public async checkTokenStatus(token: Token) {
    // check for expires
    if (isGranularToken(token) && dayjs(token.expiredAt).isBefore(new Date())) {
      throw new UnauthorizedError('Token expired');
    }

    token.lastUsedAt = new Date();
    this.userRepository.saveToken(token);
  }

  public async checkGranularTokenAccess(token: Token, fullname: string) {
    // check for scope whitelist
    const [scope, name] = getScopeAndName(fullname);
    // check for packages whitelist
    const allowedPackages = await this.listTokenPackages(token);

    // check for scope & packages access
    if (isEmpty(allowedPackages) && isEmpty(token.allowedScopes)) {
      return true;
    }

    const existPkgConfig = allowedPackages?.find(
      pkg => pkg.scope === scope && pkg.name === name
    );
    if (existPkgConfig) {
      return true;
    }

    const existScopeConfig = token.allowedScopes?.find(s => s === scope);
    if (existScopeConfig) {
      return true;
    }

    throw new ForbiddenError(`can't access package "${fullname}"`);
  }

  async getUserAndToken(authorization: string) {
    if (!authorization) return null;
    const matchs = /^Bearer ([\w.]+?)$/.exec(authorization);
    if (!matchs) return null;
    const tokenValue = matchs[1];
    const tokenKey = sha512(tokenValue);
    const authorizedUserAndToken =
      await this.userRepository.findUserAndTokenByTokenKey(tokenKey);
    return authorizedUserAndToken;
  }
}
