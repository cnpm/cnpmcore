import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';

import { SsoService } from 'app/core/service/SsoService';

describe('test/core/service/SsoService/auth.test.ts', () => {
  let ctx: Context;
  let ssoService: SsoService;
  const mockedAccessToken = 'mock_access_token';

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    ssoService = await ctx.getEggObject(SsoService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('getLoginUrlAndToken()', () => {
    it('should get url and token', () => {
      const { oauth2 } = app.config.cnpmcore;
      const { clientId, redirectUri, authorizationUri } = oauth2;
      const [ url, token ] = ssoService.getLoginUrlAndToken();
      const u = new URL(url);
      const query = u.searchParams;
      assert(query.get('client_id') === clientId);
      assert(query.get('redirect_uri') === redirectUri);
      assert(query.get('state') === token);
      assert(`${u.origin}${u.pathname}` === authorizationUri);
      assert.match(token, /^cnpm_\w+/);
    });
  });

  describe('getAccessToken()', () => {
    it('should get access token', async () => {
      const { oauth2 } = app.config.cnpmcore;
      const { accessTokenUri } = oauth2;
      app.mockHttpclient(accessTokenUri, {
        status: 200,
        data: {
          access_token: mockedAccessToken,
        },
      });
      const accessToken = await ssoService.getAccessToken('mock_code');
      assert(accessToken.access_token === mockedAccessToken);
    });
  });

  describe('getUserInfo()', async () => {
    it('should get user info', async () => {
      const { oauth2 } = app.config.cnpmcore;
      const { userInfoUri } = oauth2;
      app.mockHttpclient(`${userInfoUri}?access_token=${mockedAccessToken}`, {
        status: 200,
        data: {
          name: 'cnpm_user',
          email: 'cnpm_user@npmmirror.com',
        },
      });
      const userInfo = await ssoService.getUserInfo(mockedAccessToken);
      assert(userInfo.name === 'cnpm_user');
      assert(userInfo.email === 'cnpm_user@npmmirror.com');
    });
  });

});
