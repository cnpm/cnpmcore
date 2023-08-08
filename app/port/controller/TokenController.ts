import { ForbiddenError, UnauthorizedError } from 'egg-errors';
import { AuthAdapter } from '../../infra/AuthAdapter';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPBody,
  HTTPParam,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import { Static, Type } from '@sinclair/typebox';
import { AbstractController } from './AbstractController';
import { TokenType, isGranularToken } from '../../core/entity/Token';

// Creating and viewing access tokens
// https://docs.npmjs.com/creating-and-viewing-access-tokens#viewing-access-tokens

const TokenOptionsRule = Type.Object({
  password: Type.String({ minLength: 8, maxLength: 100 }),
  readonly: Type.Optional(Type.Boolean()),
  automation: Type.Optional(Type.Boolean()),
  // only allow 10 ip for now
  cidr_whitelist: Type.Optional(Type.Array(Type.String({ maxLength: 100 }), { maxItems: 10 })),
});
type TokenOptions = Static<typeof TokenOptionsRule>;

const GranularTokenOptionsRule = Type.Object({
  automation: Type.Optional(Type.Boolean()),
  readonly: Type.Optional(Type.Boolean()),
  cidr_whitelist: Type.Optional(Type.Array(Type.String({ maxLength: 100 }), { maxItems: 10 })),
  name: Type.String({ maxLength: 255 }),
  description: Type.Optional(Type.String({ maxLength: 255 })),
  allowedScopes: Type.Optional(Type.Array(Type.String({ maxLength: 100 }), { maxItems: 50 })),
  allowedPackages: Type.Optional(Type.Array(Type.String({ maxLength: 100 }), { maxItems: 50 })),
  expires: Type.Number({ minimum: 1, maximum: 365 }),
});
type GranularTokenOptions = Static<typeof GranularTokenOptionsRule>;

@HTTPController()
export class TokenController extends AbstractController {
  @Inject()
  private readonly authAdapter: AuthAdapter;
  // https://github.com/npm/npm-profile/blob/main/lib/index.js#L233
  @HTTPMethod({
    path: '/-/npm/v1/tokens',
    method: HTTPMethodEnum.POST,
  })
  async createToken(@Context() ctx: EggContext, @HTTPBody() tokenOptions: TokenOptions) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    ctx.tValidate(TokenOptionsRule, tokenOptions);

    if (!this.userService.checkPassword(authorizedUser, tokenOptions.password)) {
      throw new UnauthorizedError('Invalid password');
    }

    const token = await this.userService.createToken(authorizedUser.userId, {
      isReadonly: tokenOptions.readonly,
      isAutomation: tokenOptions.automation,
      cidrWhitelist: tokenOptions.cidr_whitelist,
    });
    return {
      token: token.token,
      key: token.tokenKey,
      cidr_whitelist: token.cidrWhitelist,
      readonly: token.isReadonly,
      automation: token.isAutomation,
      created: token.createdAt,
      updated: token.updatedAt,
    };
  }

  // https://github.com/npm/npm-profile/blob/main/lib/index.js#L224
  @HTTPMethod({
    path: '/-/npm/v1/tokens/token/:tokenKey',
    method: HTTPMethodEnum.DELETE,
  })
  async removeToken(@Context() ctx: EggContext, @HTTPParam() tokenKey: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    await this.userService.removeToken(authorizedUser.userId, tokenKey);
    return { ok: true };
  }

  // https://github.com/npm/npm-profile/blob/main/lib/index.js#L220
  @HTTPMethod({
    path: '/-/npm/v1/tokens',
    method: HTTPMethodEnum.GET,
  })
  async listTokens(@Context() ctx: EggContext) {
    // {
    //   'user-agent': 'npm/8.1.2 node/v16.13.1 darwin arm64 workspaces/false',
    //   'npm-command': 'token',
    //   authorization: 'Bearer token-value',
    //   accept: '*/*',
    //   'accept-encoding': 'gzip,deflate',
    //   host: 'localhost:7001',
    //   connection: 'keep-alive'
    // }
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const tokens = await this.userRepository.listTokens(authorizedUser.userId);
    // {
    //   "objects": [
    //     {
    //       "token": "npm_0i",
    //       "key": "fd69297400579a2ff8b0f224e67214d326ce9bfaf72509cd57c0be2fe6c4a6434b4c4f9f318416569e5ab7c535d12bde5e29ec386373a73c6b2ce2988dc26a22",
    //       "cidr_whitelist": null,
    //       "readonly": false,
    //       "automation": false,
    //       "created": "2021-12-04T17:23:39.744Z",
    //       "updated": "2021-12-04T17:23:39.744Z"
    //     }
    //   ],
    //   "total": 2,
    //   "urls": {}
    // }
    const objects = tokens.filter(token => !isGranularToken(token))
      .map(token => {
        return {
          token: token.tokenMark,
          key: token.tokenKey,
          cidr_whitelist: token.cidrWhitelist,
          readonly: token.isReadonly,
          automation: token.isAutomation,
          created: token.createdAt,
          lastUsedAt: token.lastUsedAt,
          updated: token.updatedAt,
        };
      });
    // TODO: paging, urls: { next: string }
    return { objects, total: objects.length, urls: {} };
  }

  private async ensureWebUser(ip = '') {
    const userRes = await this.authAdapter.ensureCurrentUser();
    if (!userRes?.name || !userRes?.email) {
      throw new ForbiddenError('need login first');
    }
    const user = await this.userService.findOrCreateUser({ name: userRes.name, email: userRes.email, ip });
    return user;
  }

  @HTTPMethod({
    path: '/-/npm/v1/tokens/gat',
    method: HTTPMethodEnum.POST,
  })
  // Create granular access token through HTTP interface
  // https://docs.npmjs.com/about-access-tokens#about-granular-access-tokens
  // Mainly has the following limitations:
  // 1. Need to submit token name and expires
  // 2. Optional to submit description, allowScopes, allowPackages information
  // 3. Need to implement ensureCurrentUser method in AuthAdapter, or pass in this.user
  async createGranularToken(@Context() ctx: EggContext, @HTTPBody() tokenOptions: GranularTokenOptions) {
    ctx.tValidate(GranularTokenOptionsRule, tokenOptions);
    const user = await this.ensureWebUser(ctx.ip);

    // 生成 Token
    const { name, description, allowedPackages, allowedScopes, cidr_whitelist, automation, readonly, expires } = tokenOptions;
    const token = await this.userService.createToken(user.userId, {
      name,
      type: TokenType.granular,
      description,
      allowedPackages,
      allowedScopes,
      isAutomation: automation,
      isReadonly: readonly,
      cidrWhitelist: cidr_whitelist,
      expires,
    });

    return {
      name: token.name,
      token: token.token,
      key: token.tokenKey,
      cidr_whitelist: token.cidrWhitelist,
      readonly: token.isReadonly,
      automation: token.isAutomation,
      allowedPackages: token.allowedPackages,
      allowedScopes: token.allowedScopes,
      created: token.createdAt,
      updated: token.updatedAt,
    };
  }

  @HTTPMethod({
    path: '/-/npm/v1/tokens/gat',
    method: HTTPMethodEnum.GET,
  })
  async listGranularTokens() {
    const user = await this.ensureWebUser();
    const tokens = await this.userRepository.listTokens(user.userId);
    const granularTokens = tokens.filter(token => isGranularToken(token));

    const objects = granularTokens.map(token => {
      const { name, description, expiredAt, allowedPackages, allowedScopes, lastUsedAt, type } = token;
      return {
        name,
        description,
        allowedPackages,
        allowedScopes,
        lastUsedAt,
        expiredAt,
        token: token.tokenMark,
        key: token.tokenKey,
        cidr_whitelist: token.cidrWhitelist,
        readonly: token.isReadonly,
        created: token.createdAt,
        updated: token.updatedAt,
        type,
      };
    });
    return { objects, total: granularTokens.length, urls: {} };
  }

  @HTTPMethod({
    path: '/-/npm/v1/tokens/gat/:tokenKey',
    method: HTTPMethodEnum.DELETE,
  })
  async removeGranularToken(@HTTPParam() tokenKey: string) {
    const user = await this.ensureWebUser();
    await this.userService.removeToken(user.userId, tokenKey);
  }
}
