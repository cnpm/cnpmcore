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
import { ForbiddenError, NotFoundError } from 'egg-errors';
import { LoginResultCode } from '../../common/enum/User';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { UserService } from '../../core/service/UserService';
import { MiddlewareController } from '../middleware';
import { AuthAdapter } from '../../infra/AuthAdapter';

const LoginRequestRule = Type.Object({
  // cli 所在机器的 hostname
  hostname: Type.String({ minLength: 1, maxLength: 100 }),
});
type LoginRequest = Static<typeof LoginRequestRule>;

const UserRule = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  password: Type.String({ minLength: 8, maxLength: 100 }),
});
type User = Static<typeof UserRule>;

const SessionRule = Type.Object({
  // uuid
  sessionId: Type.String({ minLength: 36, maxLength: 36 }),
});

@HTTPController()
export class WebauthController extends MiddlewareController {
  @Inject()
  private cacheAdapter: CacheAdapter;
  @Inject()
  private authAdapter: AuthAdapter;
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
    ctx.tValidate(LoginRequestRule, loginRequest);
    return this.authAdapter.getAuthUrl(ctx);
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
    ctx.tValidate(SessionRule, { sessionId });
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
      const message = err.message;
      this.setBasicAuth(ctx);
      return `Unauthorized, ${message}`;
    }

    if (this.config.cnpmcore.allowPublicRegistration === false) {
      if (!this.config.cnpmcore.admins[user.name]) {
        ctx.status = 403;
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
      const createRes = await this.userService.ensureTokenByUser({
        name: user.name,
        password: user.password,
        // FIXME: email verify
        email: `${user.name}@webauth.cnpmjs.org`,
        ip: ctx.ip,
      });
      token = createRes.token!;
    }

    await this.cacheAdapter.set(sessionId, token);
    ctx.redirect('/-/v1/login/request/success');
  }

  @HTTPMethod({
    path: '/-/v1/login/sso/:sessionId',
    method: HTTPMethodEnum.POST,
  })
  async ssoRequest(@Context() ctx: EggContext, @HTTPParam() sessionId: string) {
    ctx.tValidate(SessionRule, { sessionId });
    const sessionData = await this.cacheAdapter.get(sessionId);
    if (sessionData !== '') {
      throw new ForbiddenError('invalid sessionId');
    }
    // get current userInfo from infra
    // @see https://github.com/eggjs/egg-userservice
    const userRes = await this.authAdapter.ensureCurrentUser();
    if (!userRes?.name || !userRes?.email) {
      throw new ForbiddenError('invalid user info');
    }
    const { name, email } = userRes;
    const { token } = await this.userService.ensureTokenByUser({ name, email, ip: ctx.ip });
    await this.cacheAdapter.set(sessionId, token!);

    return { success: true };
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
    ctx.tValidate(SessionRule, { sessionId });
    const token = await this.cacheAdapter.get(sessionId);
    if (typeof token !== 'string') {
      throw new NotFoundError('session not found');
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
