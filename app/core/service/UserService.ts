import crypto from 'crypto';
import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { NotFoundError, ForbiddenError } from 'egg-errors';
import { UserRepository } from '../../repository/UserRepository';
import { User as UserEntity } from '../entity/User';
import { Token as TokenEntity, TokenType } from '../entity/Token';
import { WebauthnCredential as WebauthnCredentialEntity } from '../entity/WebauthnCredential';
import { LoginResultCode } from '../../common/enum/User';
import { integrity, checkIntegrity, randomToken, sha512 } from '../../common/UserUtil';
import { AbstractService } from '../../common/AbstractService';
import { RegistryManagerService } from './RegistryManagerService';
import { getPrefixedName } from '../../common/PackageUtil';
import { Registry } from '../entity/Registry';

type Optional<T, K extends keyof T> = Omit < T, K > & Partial<T> ;

type CreateUser = {
  name: string;
  email: string;
  password: string;
  ip: string;
};

type LoginResult = {
  code: LoginResultCode;
  user?: UserEntity;
  token?: TokenEntity;
};

type CreateTokenOption = CreateClassicTokenOptions | CreateGranularTokenOptions;

type CreateGranularTokenOptions = {
  type: TokenType.granular;
  name: string;
  description?: string;
  allowedScopes?: string[];
  allowedPackages?: string[];
  isReadonly?: boolean;
  cidrWhitelist?: string[];
  expires: number;
};

type CreateClassicTokenOptions = {
  isReadonly?: boolean;
  isAutomation?: boolean;
  cidrWhitelist?: string[];
};

type CreateWebauthnCredentialOptions = {
  credentialId: string;
  publicKey: string;
  browserType?: string;
};

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class UserService extends AbstractService {
  @Inject()
  private readonly userRepository: UserRepository;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;

  checkPassword(user: UserEntity, password: string): boolean {
    const plain = `${user.passwordSalt}${password}`;
    return checkIntegrity(plain, user.passwordIntegrity);
  }

  async findUserByNameOrDisplayName(name: string) {
    const hasPrefix = name.includes(':');
    if (hasPrefix) {
      return await this.findUserByName(name);
    }

    const selfRegistry = await this.registryManagerService.ensureSelfRegistry();
    const selfUser = await this.findUserByName(getPrefixedName(selfRegistry.userPrefix, name));
    if (selfUser) {
      return selfUser;
    }

    const defaultRegistry = await this.registryManagerService.ensureDefaultRegistry();
    const defaultUser = await this.findUserByName(getPrefixedName(defaultRegistry.userPrefix, name));

    return defaultUser;
  }

  async findInRegistry(registry:Registry, name: string): Promise<UserEntity | null> {
    return await this.findUserByName(getPrefixedName(registry.userPrefix, name));
  }

  async findUserByName(name: string): Promise<UserEntity | null> {
    return await this.userRepository.findUserByName(name);
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

  async findOrCreateUser({ name, email, ip, password = crypto.randomUUID() }: Optional<CreateUser, 'password'>) {
    let user = await this.userRepository.findUserByName(name);
    if (!user) {
      const createRes = await this.create({
        name,
        email,
        password,
        ip,
      });
      user = createRes.user;
    }

    return user;
  }

  async ensureTokenByUser(opts: Optional<CreateUser, 'password'>) {
    const user = await this.findOrCreateUser(opts);
    const token = await this.createToken(user.userId);
    return { user, token };
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

  async saveUser(userPrefix = 'npm:', name: string, email: string): Promise<{ changed: boolean, user: UserEntity }> {
    const storeName = name.startsWith('name:') ? name : `${userPrefix}${name}`;
    let user = await this.userRepository.findUserByName(storeName);
    if (!user) {
      const passwordSalt = crypto.randomBytes(20).toString('hex');
      const passwordIntegrity = integrity(passwordSalt);
      user = UserEntity.create({
        name: storeName,
        email,
        ip: '',
        passwordSalt,
        passwordIntegrity,
        isPrivate: false,
      });
      await this.userRepository.saveUser(user);
      return { changed: true, user };
    }
    if (user.email === email) {
      // skip
      return { changed: false, user };
    }
    user.email = email;
    await this.userRepository.saveUser(user);
    return { changed: true, user };
  }

  async createToken(userId: string, options: CreateTokenOption = {}) {
    // https://github.blog/2021-09-23-announcing-npms-new-access-token-format/
    // https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/
    // https://github.blog/changelog/2022-12-06-limit-scope-of-npm-tokens-with-the-new-granular-access-tokens/
    const token = randomToken(this.config.cnpmcore.name);
    const tokenKey = sha512(token);
    const tokenMark = token.substring(0, token.indexOf('_') + 4);
    const tokenEntity = TokenEntity.create({
      tokenKey,
      tokenMark,
      userId,
      ...options,
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
      throw new NotFoundError(`Token "${tokenKeyOrTokenValue}" not exists`);
    }
    if (token.userId !== userId) {
      throw new ForbiddenError(`Not authorized to remove token "${tokenKeyOrTokenValue}"`);
    }
    await this.userRepository.removeToken(token.tokenId);
  }

  async findWebauthnCredential(userId: string, browserType: string | undefined | null) {
    const credential = await this.userRepository.findCredentialByUserIdAndBrowserType(userId, browserType || null);
    return credential;
  }

  async createWebauthnCredential(userId: string | undefined, options: CreateWebauthnCredentialOptions) {
    const credentialEntity = WebauthnCredentialEntity.create({
      userId: userId as string,
      credentialId: options.credentialId,
      publicKey: options.publicKey,
      browserType: options.browserType,
    });
    await this.userRepository.saveCredential(credentialEntity);
    return credentialEntity;
  }

  async removeWebauthnCredential(userId?: string, browserType?: string) {
    const credential = await this.userRepository.findCredentialByUserIdAndBrowserType(userId, browserType || null);
    if (credential) {
      await this.userRepository.removeCredential(credential.wancId);
    }
  }

}
