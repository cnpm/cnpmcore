import { Type, type Static } from '@eggjs/typebox-validate/typebox';
import { HTTPContext, Context, HTTPBody, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam } from 'egg';
import { ForbiddenError, NotFoundError, UnauthorizedError, UnprocessableEntityError } from 'egg/errors';

import { LoginResultCode } from '../../common/enum/User.ts';
import { sha512 } from '../../common/UserUtil.ts';
import { isGranularToken } from '../../core/entity/Token.ts';
import { AbstractController } from './AbstractController.ts';

const ProfileUpdateRequestRule = Type.Object({
  fullname: Type.Optional(Type.String({ maxLength: 200 })),
  homepage: Type.Optional(Type.String({ maxLength: 400 })),
  freenode: Type.Optional(Type.String({ maxLength: 100 })),
  twitter: Type.Optional(Type.String({ maxLength: 100 })),
  github: Type.Optional(Type.String({ maxLength: 100 })),
});
type ProfileUpdateRequest = Static<typeof ProfileUpdateRequestRule>;

// body: {
//   _id: 'org.couchdb.user:dddd',
//   name: 'dddd',
//   password: '***',
//   type: 'user',
//   roles: [],
//   date: '2021-12-03T13:14:21.712Z'
// }
// create user will contains email
// {
//   _id: 'org.couchdb.user:awldj',
//   name: 'awldj',
//   password: '***',
//   email: 'ddd@dawd.com',
//   type: 'user',
//   roles: [],
//   date: '2021-12-03T13:46:30.644Z'
// }
const UserRule = Type.Object({
  type: Type.Literal('user'),
  // date: Type.String({ format: 'date-time' }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  // https://docs.npmjs.com/policies/security#password-policies
  // Passwords should contain alpha-numeric characters and symbols.
  // Passwords should be a minimum of 8 characters.
  password: Type.String({ minLength: 8, maxLength: 100 }),
  email: Type.Optional(Type.String({ format: 'email' })),
});
type User = Static<typeof UserRule>;

@HTTPController()
export class UserController extends AbstractController {
  // https://github.com/npm/npm-profile/blob/main/lib/index.js#L127
  @HTTPMethod({
    path: '/-/user/org.couchdb.user::username',
    method: HTTPMethodEnum.PUT,
  })
  async loginOrCreateUser(@HTTPContext() ctx: Context, @HTTPParam() username: string, @HTTPBody() user: User) {
    // headers: {
    //   'user-agent': 'npm/8.1.2 node/v16.13.1 darwin arm64 workspaces/false',
    //   'npm-command': 'adduser',
    //   'content-type': 'application/json',
    //   accept: '*/*',
    //   'content-length': '124',
    //   'accept-encoding': 'gzip,deflate',
    //   host: 'localhost:7001',
    //   connection: 'keep-alive'
    // }
    // console.log(username, user, ctx.headers, ctx.href);
    ctx.tValidate(UserRule, user);
    if (username !== user.name) {
      throw new UnprocessableEntityError(`username(${username}) not match user.name(${user.name})`);
    }
    if (this.config.cnpmcore.allowPublicRegistration === false && !this.config.cnpmcore.admins[user.name]) {
      throw new ForbiddenError('Public registration is not allowed');
    }

    const result = await this.userService.login(user.name, user.password);
    // user exists and password not match
    if (result.code === LoginResultCode.Fail) {
      throw new UnauthorizedError('Please check your login name and password');
    }

    if (result.code === LoginResultCode.Success) {
      // login success
      // TODO: 2FA feature
      ctx.status = 201;
      return {
        ok: true,
        id: `org.couchdb.user:${result.user?.displayName}`,
        rev: result.user?.userId,
        token: result.token?.token,
      };
    }

    // others: LoginResultCode.UserNotFound
    // 1. login request
    if (!user.email) {
      // user not exists
      throw new NotFoundError(`User ${user.name} not exists`);
    }

    // 2. create user request
    const { user: userEntity, token } = await this.userService.create({
      name: user.name,
      password: user.password,
      email: user.email,
      ip: ctx.ip,
    });
    ctx.status = 201;
    return {
      ok: true,
      id: `org.couchdb.user:${userEntity.displayName}`,
      rev: userEntity.userId,
      token: token.token,
    };
  }

  // https://github.com/npm/cli/blob/latest/lib/commands/logout.js#L24
  @HTTPMethod({
    path: '/-/user/token/:token',
    method: HTTPMethodEnum.DELETE,
  })
  async logout(@HTTPContext() ctx: Context, @HTTPParam() token: string) {
    const authorizedUserAndToken = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    if (!authorizedUserAndToken) return { ok: false };
    if (authorizedUserAndToken.token.tokenKey !== sha512(token)) {
      throw new UnprocessableEntityError('invalid token');
    }
    await this.userService.removeToken(authorizedUserAndToken.user.userId, token);
    return { ok: true };
  }

  // https://github.com/npm/cli/blob/latest/lib/commands/owner.js#L154
  @HTTPMethod({
    path: '/-/user/org.couchdb.user::username',
    method: HTTPMethodEnum.GET,
  })
  async showUser(@HTTPContext() ctx: Context, @HTTPParam() username: string) {
    const user = await this.userService.findUserByNameOrDisplayName(username);
    if (!user) {
      throw new NotFoundError(`User "${username}" not found`);
    }
    const authorized = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    return {
      _id: `org.couchdb.user:${user.displayName}`,
      name: user.displayName,
      email: authorized ? user.email : undefined,
    };
  }

  // https://github.com/npm/cli/blob/latest/lib/utils/get-identity.js#L20
  @HTTPMethod({
    path: '/-/whoami',
    method: HTTPMethodEnum.GET,
  })
  async whoami(@HTTPContext() ctx: Context) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const authorizedRes = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const { token, user } = authorizedRes!;

    if (isGranularToken(token)) {
      const { name, description, expiredAt, allowedPackages, allowedScopes, lastUsedAt, type } = token;
      return {
        username: user.displayName,
        name,
        description,
        allowedPackages,
        allowedScopes,
        lastUsedAt,
        expiredAt,
        // do not return token value
        // token: token.token,
        key: token.tokenKey,
        cidr_whitelist: token.cidrWhitelist,
        readonly: token.isReadonly,
        created: token.createdAt,
        updated: token.updatedAt,
        type,
      };
    }
    return {
      username: user.displayName,
    };
  }

  // https://github.com/cnpm/cnpmcore/issues/64
  @HTTPMethod({
    path: '/-/_view/starredByUser',
    method: HTTPMethodEnum.GET,
  })
  async starredByUser() {
    throw new ForbiddenError('npm stars is not allowed');
  }

  // https://github.com/cnpm/cnpmcore/issues/64
  // https://github.com/npm/registry/blob/master/docs/user/profile.md
  @HTTPMethod({
    path: '/-/npm/v1/user',
    method: HTTPMethodEnum.GET,
  })
  async showProfile(@HTTPContext() ctx: Context) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const user = await this.userRepository.findUserByName(authorizedUser.name);
    return {
      tfa: null,
      name: authorizedUser.displayName,
      email: authorizedUser.email,
      email_verified: false,
      created: authorizedUser.createdAt,
      updated: authorizedUser.updatedAt,
      fullname: user?.fullname ?? '',
      homepage: user?.homepage ?? '',
      freenode: user?.freenode ?? '',
      twitter: user?.twitter ?? '',
      github: user?.github ?? '',
    };
  }

  // https://github.com/cnpm/cnpmcore/issues/519
  // https://github.com/npm/registry/blob/master/docs/user/profile.md
  @HTTPMethod({
    path: '/-/npm/v1/user',
    method: HTTPMethodEnum.POST,
  })
  async saveProfile(@HTTPContext() ctx: Context, @HTTPBody() body: ProfileUpdateRequest) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const user = await this.userRepository.findUserByName(authorizedUser.name);
    if (!user) {
      throw new NotFoundError(`User "${authorizedUser.name}" not found`);
    }

    // Update profile fields
    if (body.fullname !== undefined) user.fullname = body.fullname;
    if (body.homepage !== undefined) user.homepage = body.homepage;
    if (body.freenode !== undefined) user.freenode = body.freenode;
    if (body.twitter !== undefined) user.twitter = body.twitter;
    if (body.github !== undefined) user.github = body.github;

    await this.userRepository.saveUser(user);

    return {
      tfa: null,
      name: authorizedUser.displayName,
      email: authorizedUser.email,
      email_verified: false,
      created: authorizedUser.createdAt,
      updated: user.updatedAt,
      fullname: user.fullname ?? '',
      homepage: user.homepage ?? '',
      freenode: user.freenode ?? '',
      twitter: user.twitter ?? '',
      github: user.github ?? '',
    };
  }
}
