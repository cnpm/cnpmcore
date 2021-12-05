import crypto from 'crypto';
import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { NotFoundError, UnauthorizedError } from 'egg-errors';
import { UserRepository } from '../../repository/UserRepository';
import { User as UserEntity } from '../entity/User';
import { Token as TokenEntity } from '../entity/Token';
import { LoginResultCode } from '../../common/enum/User';
import { integrity, checkIntegrity, randomToken, sha512 } from '../../common/UserUtil';
import { AbstractService } from './AbstractService';

type CreateUser = {
  name: string;
  password: string;
  email: string;
  ip: string;
};

type LoginResult = {
  code: LoginResultCode;
  user?: UserEntity;
  token?: TokenEntity;
};

type CreateTokenOptions = {
  isReadonly?: boolean;
  isAutomation?: boolean;
  cidrWhitelist?: string[];
};

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class UserService extends AbstractService {
  @Inject()
  private readonly userRepository: UserRepository;

  checkPassword(user: UserEntity, password: string): boolean {
    const plain = `${user.passwordSalt}${password}`;
    return checkIntegrity(plain, user.passwordIntegrity);
  }

  async login(name: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findUserByName(name);
    if (!user) return { code: LoginResultCode.UserNotFound };
    if (!this.checkPassword(user, password)) {
      return { code: LoginResultCode.Fail };
    }
    const token = await this.createToken(user.userId);
    return { code: LoginResultCode.Success, user, token };
  }

  async create(createUser: CreateUser) {
    const passwordSalt = crypto.randomBytes(30).toString('hex');
    const plain = `${passwordSalt}${createUser.password}`;
    const passwordIntegrity = integrity(plain);
    const userEntity = UserEntity.create({
      name: createUser.name,
      email: createUser.email,
      ip: createUser.ip,
      passwordSalt,
      passwordIntegrity,
      isPrivate: true,
    });
    await this.userRepository.saveUser(userEntity);
    const token = await this.createToken(userEntity.userId);
    return { user: userEntity, token };
  }

  async createToken(userId: string, options: CreateTokenOptions = {}) {
    // https://github.blog/2021-09-23-announcing-npms-new-access-token-format/
    // https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/
    const token = randomToken(this.config.cnpmcore.name);
    const tokenKey = sha512(token);
    const tokenMark = token.substring(0, token.indexOf('_') + 4);
    const tokenEntity = TokenEntity.create({
      tokenKey,
      tokenMark,
      userId,
      cidrWhitelist: options.cidrWhitelist ?? [],
      isReadonly: options.isReadonly ?? false,
      isAutomation: options.isAutomation ?? false,
    });
    await this.userRepository.saveToken(tokenEntity);
    tokenEntity.token = token;
    return tokenEntity;
  }

  async removeToken(userId: string, tokenKeyOrTokenValue: string) {
    let token = await this.userRepository.findTokenByTokenKey(tokenKeyOrTokenValue);
    if (!token) {
      // tokenKeyOrTokenValue is token value, sha512 and find again
      token = await this.userRepository.findTokenByTokenKey(sha512(tokenKeyOrTokenValue));
    }
    if (!token) {
      throw new NotFoundError(`Token '${tokenKeyOrTokenValue}' not exists`);
    }
    if (token.userId !== userId) {
      throw new UnauthorizedError(`Not authorized to remove token '${tokenKeyOrTokenValue}'`);
    }
    await this.userRepository.removeToken(token.tokenId);
  }
}
