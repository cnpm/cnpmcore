import { randomUUID } from 'crypto';
import {
  Inject,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggAppConfig,
} from 'egg';
import { Static, Type } from '@sinclair/typebox';
import { LoginResultCode } from '../common/enum/User';
import { CacheAdapter } from '../common/adapter/CacheAdapter';
import { UserService } from '../core/service/UserService';
import { MiddlewareController } from '../port/middleware';

const LoginRequestRule = Type.Object({
  // cli 所在机器的 hostname
  hostname: Type.String({ minLength: 1, maxLength: 100 }),
  create: Type.Optional(Type.Boolean({ default: false })),
});
type LoginRequest = Static<typeof LoginRequestRule>;

const UserRule = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  password: Type.String({ minLength: 8, maxLength: 100 }),
});
type User = Static<typeof UserRule>;

@HTTPController()
export class WebauthController extends MiddlewareController {
  @Inject()
  private cacheAdapter: CacheAdapter;
  @Inject()
  protected logger: EggLogger;
  @Inject()
  protected config: EggAppConfig;
  @Inject()
  protected userService: UserService;

  // https://github.com/cnpm/cnpmcore/issues/348
  @HTTPMethod({
    path: '/-/v1/login',
    method: HTTPMethodEnum.POST,
  })
  async login(@Context() ctx: EggContext, @HTTPBody() loginRequest: LoginRequest) {
    console.log(loginRequest, ctx.href, ctx.host, ctx.protocol);
    ctx.tValidate(LoginRequestRule, loginRequest);
    const sessionId = randomUUID();
    await this.cacheAdapter.set(sessionId, '');
    return {
      loginUrl: `${ctx.href}/request/session/${sessionId}`,
      doneUrl: `${ctx.href}/done/session/${sessionId}`,
    };
  }

  private setBasicAuth(ctx: EggContext) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic realm="Login to cnpmcore"');
  }

  @HTTPMethod({
    path: '/-/v1/login/request/session/:sessionId',
    method: HTTPMethodEnum.GET,
  })
  async loginRequest(@Context() ctx: EggContext, @HTTPParam() sessionId: string) {
    ctx.type = 'html';
    const sessionToken = await this.cacheAdapter.get(sessionId);
    if (typeof sessionToken !== 'string') {
      ctx.status = 404;
      return '<h1>😭😭😭 Session not found, please try again on your command line 😭😭😭</h1>';
    }
    // Basic auth
    const authorization = ctx.get('authorization');
    if (!authorization) {
      this.setBasicAuth(ctx);
      return 'Unauthorized';
    }
    // 'Basic xxxx=='
    if (!authorization.startsWith('Basic ')) {
      this.setBasicAuth(ctx);
      return 'Unauthorized, invalid authorization, only support "Basic" authorization';
    }
    const base64String = authorization.replace('Basic ', '');
    // {user}:{pass}
    const userAuth = Buffer.from(base64String, 'base64').toString();
    const sepIndex = userAuth.indexOf(':');
    const username = userAuth.substring(0, sepIndex);
    const password = userAuth.substring(sepIndex + 1);
    const user: User = {
      name: username,
      password,
    };
    try {
      ctx.tValidate(UserRule, user);
    } catch (err) {
      let message = err.message;
      const item = err.errors[0];
      if (item.instancePath) {
        message = `${item.instancePath.substring(1)}: ${item.message}`;
      } else {
        message = item.message;
      }
      this.setBasicAuth(ctx);
      return `Unauthorized, ${message}`;
    }

    if (this.config.cnpmcore.allowPublicRegistration === false) {
      if (!this.config.cnpmcore.admins[user.name]) {
        return '<h1>😭😭😭 Public registration is not allowed 😭😭😭</h1>';
      }
    }

    const result = await this.userService.login(user.name, user.password);
    // user exists and password not match
    if (result.code === LoginResultCode.Fail) {
      this.setBasicAuth(ctx);
      return '<h1>😭😭😭 Please check your login name and password 😭😭😭</h1>';
    }

    let token = '';
    if (result.code === LoginResultCode.Success) {
      // login success
      token = result.token!.token!;
    } else {
      // others: LoginResultCode.UserNotFound
      // create user request
      const { token: tokenEntity, user: userEntity } = await this.userService.create({
        name: user.name,
        password: user.password,
        // FIXME: email verify
        email: `${user.name}@webauth.cnpmjs.org`,
        ip: ctx.ip,
      });
      this.logger.info('[WebauthController.loginRequest] create new user: %s', userEntity.userId);
      token = tokenEntity.token!;
    }

    await this.cacheAdapter.set(sessionId, token);
    ctx.redirect('/-/v1/login/request/success');
  }

  @HTTPMethod({
    path: '/-/v1/login/request/success',
    method: HTTPMethodEnum.GET,
  })
  async loginRequestSuccess(@Context() ctx: EggContext) {
    ctx.type = 'html';
    return `<h1>😁😁😁 Authorization Successful 😁😁😁</h1>
    <p>You can close this tab and return to your command line.</p>`;
  }

  @HTTPMethod({
    path: '/-/v1/login/done/session/:sessionId',
    method: HTTPMethodEnum.GET,
  })
  async loginDone(@Context() ctx: EggContext, @HTTPParam() sessionId: string) {
    const token = await this.cacheAdapter.get(sessionId);
    if (typeof token !== 'string') {
      ctx.status = 404;
      return { message: 'session not found' };
    }
    if (token === '') {
      ctx.status = 202;
      ctx.set('retry-after', '1');
      return { message: 'processing' };
    }
    // only get once
    await this.cacheAdapter.delete(sessionId);
    return { token };
  }
}
