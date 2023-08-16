import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { User as UserModel } from './model/User';
import type { Package as PackageModel } from './model/Package';
import type { Token as TokenModel } from './model/Token';
import type { WebauthnCredential as WebauthnCredentialModel } from './model/WebauthnCredential';
import { User as UserEntity } from '../core/entity/User';
import { Token as TokenEntity, isGranularToken } from '../core/entity/Token';
import { WebauthnCredential as WebauthnCredentialEntity } from '../core/entity/WebauthnCredential';
import { AbstractRepository } from './AbstractRepository';
import { TokenPackage as TokenPackageModel } from './model/TokenPackage';
import { getFullname, getScopeAndName } from '../common/PackageUtil';
import { PackageRepository } from './PackageRepository';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class UserRepository extends AbstractRepository {
  @Inject()
  private readonly User: typeof UserModel;

  @Inject()
  private readonly Token: typeof TokenModel;

  @Inject()
  private readonly TokenPackage: typeof TokenPackageModel;

  @Inject()
  private readonly Package: typeof PackageModel;

  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly WebauthnCredential: typeof WebauthnCredentialModel;

  async saveUser(user: UserEntity): Promise<void> {
    if (user.id) {
      const model = await this.User.findOne({ id: user.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(user, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(user, this.User);
      this.logger.info('[UserRepository:saveUser:new] id: %s, userId: %s', model.id, model.userId);
    }
  }

  async findUserByName(name: string) {
    const model = await this.User.findOne({ name });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, UserEntity);
  }

  async findUserByUserId(userId: string) {
    const model = await this.User.findOne({ userId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, UserEntity);
  }

  async findUserAndTokenByTokenKey(tokenKey: string) {
    const token = await this.findTokenByTokenKey(tokenKey);
    if (!token) return null;
    const userModel = await this.User.findOne({ userId: token.userId });
    if (!userModel) return null;

    return {
      token,
      user: ModelConvertor.convertModelToEntity(userModel, UserEntity),
    };
  }

  async findTokenByTokenKey(tokenKey: string) {
    const model = await this.Token.findOne({ tokenKey });
    if (!model) return null;
    const token = ModelConvertor.convertModelToEntity(model, TokenEntity);
    await this._injectTokenPackages(token);
    return token;
  }

  private async _injectTokenPackages(token: TokenEntity) {
    if (isGranularToken(token)) {
      const models = await this.TokenPackage.find({ tokenId: token.tokenId });
      const packages = await this.Package.find({ packageId: models.map(m => m.packageId) });
      if (Array.isArray(packages)) {
        token.allowedPackages = packages.map(p => getFullname(p.scope, p.name));
      }
    }
  }

  async saveToken(token: TokenEntity): Promise<void> {
    // create
    let model: TokenModel;
    // update
    if (token.id) {
      const res = await this.Token.findOne({ id: token.id });
      if (!res) return;
      model = res;
      await ModelConvertor.saveEntityToModel(token, model);
    } else {
      if (isGranularToken(token)) {
        await this.TokenPackage.transaction(async transaction => {
          model = await ModelConvertor.convertEntityToModel(token, this.Token, transaction);
          if (Array.isArray(token.allowedPackages)) {
            for (const packageName of token.allowedPackages) {
              const [ scope, name ] = getScopeAndName(packageName);
              const packageId = await this.packageRepository.findPackageId(scope, name);
              if (packageId) {
                await this.TokenPackage.create({ packageId, tokenId: token.tokenId }, transaction);
              }
            }
          }
        });
      } else {
        model = await ModelConvertor.convertEntityToModel(token, this.Token);
      }
      this.logger.info('[UserRepository:saveToken:new] id: %s, tokenId: %s', model!.id, model!.tokenId);
    }
  }

  async removeToken(tokenId: string) {
    await this.Token.transaction(async transaction => {
      const removeCount = await this.Token.remove({ tokenId }, true, transaction);
      await this.TokenPackage.remove({ tokenId }, true, transaction);
      this.logger.info('[UserRepository:removeToken:remove] %d rows, tokenId: %s',
        removeCount, tokenId);
    });
  }

  async listTokens(userId: string): Promise<TokenEntity[]> {
    const models = await this.Token.find({ userId });
    const tokens = models.map(model => ModelConvertor.convertModelToEntity(model, TokenEntity));
    for (const token of tokens) {
      await this._injectTokenPackages(token);
    }
    return tokens;
  }

  async saveCredential(credential: WebauthnCredentialEntity): Promise<void> {
    if (credential.id) {
      const model = await this.WebauthnCredential.findOne({ id: credential.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(credential, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(credential, this.WebauthnCredential);
      this.logger.info('[UserRepository:saveCredential:new] id: %s, wancId: %s', model.id, model.wancId);
    }
  }

  async findCredentialByUserIdAndBrowserType(userId: string | undefined, browserType: string | null) {
    const model = await this.WebauthnCredential.findOne({
      userId,
      browserType,
    });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, WebauthnCredentialEntity);
  }

  async removeCredential(wancId: string) {
    const removeCount = await this.WebauthnCredential.remove({ wancId });
    this.logger.info('[UserRepository:removeCredential:remove] %d rows, wancId: %s', removeCount, wancId);
  }
}
