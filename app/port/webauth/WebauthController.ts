import {
  Inject,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
  HTTPQuery,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggAppConfig,
} from 'egg';
import { Static, Type } from '@sinclair/typebox';
import { ForbiddenError, NotFoundError } from 'egg-errors';
import { createHash } from 'crypto';
import base64url from 'base64url';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import { LoginResultCode, WanStatusCode } from '../../common/enum/User';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { UserService } from '../../core/service/UserService';
import { MiddlewareController } from '../middleware';
import { AuthAdapter } from '../../infra/AuthAdapter';
import { genRSAKeys, decryptRSA } from '../../common/CryptoUtil';
import { getBrowserTypeForWebauthn } from '../../common/UserUtil';

const LoginRequestRule = Type.Object({
  // cli 所在机器的 hostname
  hostname: Type.String({ minLength: 1, maxLength: 100 }),
});
type LoginRequest = Static<typeof LoginRequestRule>;

type LoginPrepareResult = {
  wanStatus: number;
  wanCredentialRegiOption?: PublicKeyCredentialCreationOptionsJSON;
  wanCredentialAuthOption?: PublicKeyCredentialRequestOptionsJSON;
};

type LoginImplementRequest = {
  accData: {
    username: string;
    password: string;
  };
  wanCredentialRegiData: unknown;
  wanCredentialAuthData: unknown;
  needUnbindWan: boolean;

};

const UserRule = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  password: Type.String({ minLength: 8, maxLength: 100 }),
});

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

  @HTTPMethod({
    path: '/-/v1/login/request/session/:sessionId',
    method: HTTPMethodEnum.GET,
  })
  async loginRender(@Context() ctx: EggContext, @HTTPParam() sessionId: string) {
    ctx.tValidate(SessionRule, { sessionId });
    ctx.type = 'html';
    const sessionToken = await this.cacheAdapter.get(sessionId);
    if (typeof sessionToken !== 'string') {
      ctx.status = 404;
      return '<h1>😭😭😭 Session not found, please try again on your command line 😭😭😭</h1>';
    }
    const keys = genRSAKeys();
    await this.cacheAdapter.set(`${sessionId}_privateKey`, keys.privateKey);
    await ctx.render('login.html', {
      sessionId,
      publicKey: keys.publicKey,
      enableWebauthn: this.config.cnpmcore.enableWebAuthn,
    });
  }

  @HTTPMethod({
    path: '/-/v1/login/request/session/:sessionId',
    method: HTTPMethodEnum.POST,
  })
  async loginImplement(@Context() ctx: EggContext, @HTTPParam() sessionId: string, @HTTPBody() loginImplementRequest: LoginImplementRequest) {
    ctx.tValidate(SessionRule, { sessionId });
    const sessionToken = await this.cacheAdapter.get(sessionId);
    if (typeof sessionToken !== 'string') {
      return { ok: false, message: 'Session not found, please try again on your command line' };
    }

    const { accData, wanCredentialRegiData, wanCredentialAuthData, needUnbindWan } = loginImplementRequest;
    const { username, password = '' } = accData;
    const enableWebAuthn = this.config.cnpmcore.enableWebAuthn;
    const isSupportWebAuthn = ctx.protocol === 'https' || ctx.hostname === 'localhost';
    let token = '';
    let user;

    // public registration
    if (this.config.cnpmcore.allowPublicRegistration === false) {
      if (!this.config.cnpmcore.admins[username]) {
        return { ok: false, message: 'Public registration is not allowed' };
      }
    }

    const browserType = getBrowserTypeForWebauthn(ctx.headers['user-agent']) || undefined;
    const expectedChallenge = (await this.cacheAdapter.get(`${sessionId}_challenge`)) || '';
    const expectedOrigin = this.config.cnpmcore.registry;
    const expectedRPID = new URL(expectedOrigin).hostname;
    // webauthn authentication
    if (enableWebAuthn && isSupportWebAuthn && wanCredentialAuthData) {
      user = await this.userService.findUserByName(username);
      if (!user) {
        return { ok: false, message: 'Unauthorized, Please check your login name' };
      }
      const credential = await this.userService.findWebauthnCredential(user.userId, browserType);
      if (!credential?.credentialId || !credential?.publicKey) {
        return { ok: false, message: 'Unauthorized, Please check your login name' };
      }
      try {
        const verification = await verifyAuthenticationResponse({
          response: wanCredentialAuthData as VerifyAuthenticationResponseOpts['response'],
          expectedChallenge,
          expectedOrigin,
          expectedRPID,
          authenticator: {
            credentialPublicKey: base64url.toBuffer(credential.publicKey),
            credentialID: base64url.toBuffer(credential.credentialId),
            counter: 0,
          },
        });
        const { verified } = verification;
        if (!verified) {
          return { ok: false, message: 'Invalid security arguments, please try again on your browser' };
        }
      } catch (err) {
        this.logger.error('[WebauthController.loginImplement:verify-authentication-fail] expectedChallenge: %s, expectedOrigin: %s, expectedRPID: %s, wanCredentialAuthData: %j, error: %j', expectedChallenge, expectedOrigin, expectedRPID, wanCredentialAuthData, err);
        return { ok: false, message: 'Authentication failed, please continue to sign in with your password' };
      }
      const createToken = await this.userService.createToken(user.userId);
      token = createToken.token!;

      await this.cacheAdapter.set(sessionId, token);
      return { ok: true };
    }

    // check privateKey valid
    const privateKey = await this.cacheAdapter.get(`${sessionId}_privateKey`);
    if (!privateKey) {
      return { ok: false, message: 'Invalid security arguments, please try again on your browser' };
    }
    // check login name and password valid
    const realPassword = decryptRSA(privateKey, password);
    try {
      ctx.tValidate(UserRule, {
        name: username,
        password: realPassword,
      });
    } catch (err) {
      const message = err.message;
      return { ok: false, message: `Unauthorized, ${message}` };
    }

    const result = await this.userService.login(username, realPassword);
    // user exists and password not match
    if (result.code === LoginResultCode.Fail) {
      return { ok: false, message: 'Please check your login name and password' };
    }

    if (result.code === LoginResultCode.Success) {
      // login success
      token = result.token!.token!;
      user = result.user;
      // need unbind webauthn credential
      if (needUnbindWan) {
        await this.userService.removeWebauthnCredential(user?.userId, browserType);
      }
    } else {
      // others: LoginResultCode.UserNotFound
      // create user request
      const createRes = await this.userService.ensureTokenByUser({
        name: username,
        password: realPassword,
        // FIXME: email verify
        email: `${username}@webauth.cnpmjs.org`,
        ip: ctx.ip,
      });
      token = createRes.token!.token!;
      user = createRes.user;
    }

    await this.cacheAdapter.set(sessionId, token);

    // webauthn registration
    if (enableWebAuthn && isSupportWebAuthn && wanCredentialRegiData) {
      try {
        const verification = await verifyRegistrationResponse({
          response: wanCredentialRegiData as VerifyRegistrationResponseOpts['response'],
          expectedChallenge,
          expectedOrigin,
          expectedRPID,
        });
        const { verified, registrationInfo } = verification;
        if (verified && registrationInfo) {
          const { credentialPublicKey, credentialID } = registrationInfo;
          const base64CredentialPublicKey = base64url.encode(Buffer.from(new Uint8Array(credentialPublicKey)));
          const base64CredentialID = base64url.encode(Buffer.from(new Uint8Array(credentialID)));
          this.userService.createWebauthnCredential(user?.userId, {
            credentialId: base64CredentialID,
            publicKey: base64CredentialPublicKey,
            browserType,
          });
        }
      } catch (err) {
        this.logger.error('[WebauthController.loginImplement:verify-registration-fail] expectedChallenge: %s, expectedOrigin: %s, expectedRPID: %s, wanCredentialRegiData: %j, error: %j', expectedChallenge, expectedOrigin, expectedRPID, wanCredentialRegiData, err);
      }
    }

    return { ok: true };
  }

  @HTTPMethod({
    path: '/-/v1/login/request/prepare/:sessionId',
    method: HTTPMethodEnum.GET,
  })
  async loginPrepare(@Context() ctx: EggContext, @HTTPParam() sessionId: string, @HTTPQuery() name: string) {
    ctx.tValidate(SessionRule, { sessionId });
    const sessionToken = await this.cacheAdapter.get(sessionId);
    if (typeof sessionToken !== 'string') {
      return { ok: false, message: 'Session not found, please try again on your command line' };
    }

    const browserType = getBrowserTypeForWebauthn(ctx.headers['user-agent']);
    const expectedRPID = new URL(this.config.cnpmcore.registry).hostname;
    const user = await this.userService.findUserByName(name);
    const result: LoginPrepareResult = { wanStatus: WanStatusCode.UserNotFound };
    let credential;
    if (user) {
      credential = await this.userService.findWebauthnCredential(user.userId, browserType);
      result.wanStatus = WanStatusCode.Unbound;
    }
    if (credential?.credentialId && credential?.publicKey) {
      result.wanStatus = WanStatusCode.Bound;
      result.wanCredentialAuthOption = generateAuthenticationOptions({
        timeout: 60000,
        rpID: expectedRPID,
        allowCredentials: [{
          id: base64url.toBuffer(credential.credentialId),
          type: 'public-key',
          transports: [ 'internal' ],
        }],
      });
      await this.cacheAdapter.set(`${sessionId}_challenge`, result.wanCredentialAuthOption.challenge);
    } else {
      const encoder = new TextEncoder();
      const regUserIdBuffer = createHash('sha256').update(encoder.encode(name)).digest();
      result.wanCredentialRegiOption = generateRegistrationOptions({
        rpName: ctx.app.config.name,
        rpID: expectedRPID,
        userID: base64url.encode(Buffer.from(regUserIdBuffer)),
        userName: name,
        userDisplayName: name,
        timeout: 60000,
        attestationType: 'direct',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
        },
      });
      await this.cacheAdapter.set(`${sessionId}_challenge`, result.wanCredentialRegiOption.challenge);
    }
    return result;
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
    await this.cacheAdapter.set(sessionId, token!.token!);

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
    await this.cacheAdapter.delete(`${sessionId}_challenge`);
    await this.cacheAdapter.delete(`${sessionId}_privateKey`);
    return { token };
  }
}
