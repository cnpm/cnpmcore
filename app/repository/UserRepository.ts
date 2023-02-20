import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { User as UserModel } from './model/User';
import type { Token as TokenModel } from './model/Token';
import { User as UserEntity } from '../core/entity/User';
import { Token as TokenEntity } from '../core/entity/Token';
import { AbstractRepository } from './AbstractRepository';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class UserRepository extends AbstractRepository {
  @Inject()
  private readonly User: typeof UserModel;

  @Inject()
  private readonly Token: typeof TokenModel;

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
    return ModelConvertor.convertModelToEntity(model, TokenEntity);
  }

  async findTokenByUserId(userId: string) {
    const model = await this.Token.findOne({ userId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, TokenEntity);
  }

  async saveToken(token: TokenEntity): Promise<void> {
    if (token.id) {
      const model = await this.Token.findOne({ id: token.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(token, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(token, this.Token);
      this.logger.info('[UserRepository:saveToken:new] id: %s, tokenId: %s', model.id, model.tokenId);
    }
  }

  async removeToken(tokenId: string) {
    const removeCount = await this.Token.remove({ tokenId });
    this.logger.info('[UserRepository:removeToken:remove] %d rows, tokenId: %s',
      removeCount, tokenId);
  }

  async listTokens(userId: string): Promise<TokenEntity[]> {
    const models = await this.Token.find({ userId });
    return models.map(model => ModelConvertor.convertModelToEntity(model, TokenEntity));
  }
}
