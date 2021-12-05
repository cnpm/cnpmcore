import { UnauthorizedError } from 'egg-errors';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPBody,
  HTTPParam,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { Static, Type } from '@sinclair/typebox';
import { AbstractController } from './AbstractController';

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

@HTTPController()
export class TokenController extends AbstractController {
  // https://github.com/npm/npm-profile/blob/main/index.js#L228
  @HTTPMethod({
    path: '/-/npm/v1/tokens',
    method: HTTPMethodEnum.POST,
  })
  async createToken(@Context() ctx: EggContext, @HTTPBody() tokenOptions: TokenOptions) {
    const authorizedUser = await this.requiredAuthorizedUser(ctx, 'setting');
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

  // https://github.com/npm/npm-profile/blob/main/index.js#L219
  @HTTPMethod({
    path: '/-/npm/v1/tokens/token/:tokenKey',
    method: HTTPMethodEnum.DELETE,
  })
  async removeToken(@Context() ctx: EggContext, @HTTPParam() tokenKey: string) {
    const authorizedUser = await this.requiredAuthorizedUser(ctx, 'setting');
    await this.userService.removeToken(authorizedUser.userId, tokenKey);
    return { ok: true };
  }

  // https://github.com/npm/npm-profile/blob/main/index.js#L215
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
    const authorizedUser = await this.requiredAuthorizedUser(ctx, 'setting');
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
    const objects = tokens.map(token => {
      return {
        token: token.tokenMark,
        key: token.tokenKey,
        cidr_whitelist: token.cidrWhitelist,
        readonly: token.isReadonly,
        automation: token.isAutomation,
        created: token.createdAt,
        updated: token.updatedAt,
      };
    });
    // TODO: paging, urls: { next: string }
    return { objects, total: objects.length, urls: {} };
  }
}
