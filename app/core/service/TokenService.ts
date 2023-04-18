import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import { Token, isGranularToken } from '../entity/Token';
import { TokenPackage as TokenPackageModel } from '../../../app/repository/model/TokenPackage';
import { Package as PackageModel } from '../../../app/repository/model/Package';
import { ModelConvertor } from '../../../app/repository/util/ModelConvertor';
import { Package as PackageEntity } from '../entity/Package';
import { ForbiddenError, UnauthorizedError } from 'egg-errors';
import { getScopeAndName } from 'app/common/PackageUtil';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TokenService extends AbstractService {
  @Inject()
  private readonly TokenPackage: typeof TokenPackageModel;
  @Inject()
  private readonly Package: typeof PackageModel;

  public async listTokenPackages(token: Token) {
    if (isGranularToken(token)) {
      const models = await this.TokenPackage.find({ tokenId: token.tokenId });
      const packages = await this.Package.find({ packageId: models.map(m => m.packageId) });
      return packages.map(pkg => ModelConvertor.convertModelToEntity(pkg, PackageEntity));
    }
    return null;
  }

  public async checkGranularTokenAccess(token: Token, fullname: string) {
    // skip classic token
    if (!isGranularToken(token)) {
      return true;
    }

    // check for expires
    if (token.createdAt.getTime() + token.expires! * 1000 * 60 * 60 * 24 < Date.now()) {
      throw new UnauthorizedError('Token expired');
    }

    // check for scope & packages access
    if (!token.allowedPackages && !token.allowedScopes) {
      return true;
    }

    // check for scope whitelist
    const [ scope, name ] = getScopeAndName(fullname);
    // check for packages whitelist
    const allowedPackages = await this.listTokenPackages(token);
    const existPkgConfig = allowedPackages?.find(pkg => pkg.scope === scope && pkg.name === name);
    if (existPkgConfig) {
      return true;
    }

    const existScopeConfig = token.allowedScopes?.find(s => s === scope);
    if (existScopeConfig) {
      return true;
    }

    throw new ForbiddenError(`can't access package "${fullname}"`);

  }

}
