import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/port/controller/UserController/loginOrCreateUser.test.ts', () => {
  let ctx: Context;
  const mockedAccessToken = 'mock_access_token';
  const mockUser = {
    name: 'cnpm_user',
    email: 'cnpm_user@npmmirror.com',
  };

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    const { oauth2 } = app.config.cnpmcore;
    mock(app.config.cnpmcore.oauth2, 'enable', true);
    const { accessTokenUri, userInfoUri } = oauth2;
    app.mockHttpclient(accessTokenUri, {
      status: 200,
      data: {
        access_token: mockedAccessToken,
      },
    });
    app.mockHttpclient(`${userInfoUri}?access_token=${mockedAccessToken}`, {
      status: 200,
      data: mockUser,
    });
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('[PUT /-/user/org.couchdb.user::username] loginOrCreateUser()', () => {
    it('should 422', async () => {
      let res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          password: 'password-is-here',
          type: 'user',
        })
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] must have required property \'name\'');
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: '123',
          type: 'user',
        })
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] password: must NOT have fewer than 8 characters');
    });

    it('should login fail, without email', async () => {
      const res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
        })
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] User leo not exists');
    });

    it('should registration forbidden when allowPublicRegistration = false', async () => {
      mock(app.config.cnpmcore, 'allowPublicRegistration', false);
      const res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
          email: 'leo@example.com',
        })
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Public registration is not allowed');
    });

    it('should admin registration success when allowPublicRegistration = false', async () => {
      mock(app.config.cnpmcore, 'allowPublicRegistration', false);
      const res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:cnpmcore_admin')
        .send({
          name: 'cnpmcore_admin',
          password: 'password-is-here',
          type: 'user',
          email: 'cnpmcore_admin@example.com',
        })
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:cnpmcore_admin');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
    });

    it('should create new user, with email', async () => {
      let res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
          email: 'leo@example.com',
        })
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:leo');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
      const lastToken = res.body.token;

      // login success
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
        })
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:leo');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
      assert.notEqual(res.body.token, lastToken);

      // login fail
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here-wrong',
          type: 'user',
        })
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Please check your login name and password');
    });

    it('should create new user, with email when config.cnpmcore.alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      let res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
          email: 'leo@example.com',
        })
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:leo');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
      const lastToken = res.body.token;

      // login success
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
        })
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:leo');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
      assert.notEqual(res.body.token, lastToken);

      // login fail
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here-wrong',
          type: 'user',
        })
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Please check your login name and password');
    });

    it('should create user with sso and token', async () => {
      let res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:npm_oauth_auth_dummy_user')
        .send({
          name: 'npm_oauth_auth_dummy_user',
          password: 'placeholder',
          type: 'user',
          email: 'support@npmjs.com',
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.id, 'org.couchdb.user:npm_oauth_auth_dummy_user');
      assert(res.body.rev);
      assert.match(res.body.token, /^cnpm_\w+/);
      assert(res.body.sso);

      const lastToken = res.body.token;
      await app.httpRequest()
        .get(`/-/sso/callback?state=${lastToken}&code=fake_sso_code`)
        .expect(302);

      const whoami = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', `Bearer ${lastToken}`)
        .expect(200);
      assert.equal(whoami.body.username, mockUser.name);
      // login again, user exits and create a another token
      res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:npm_oauth_auth_dummy_user')
        .send({
          name: 'npm_oauth_auth_dummy_user',
          password: 'placeholder',
          type: 'user',
          email: 'support@npmjs.com',
        })
        .expect(200);
      const token = res.body.token;
      await app.httpRequest()
        .get(`/-/sso/callback?state=${token}&code=fake_sso_code`)
        .expect(302);
      assert.notEqual(lastToken, token);
    });

    it('should throw error when email is empty', async () => {
      const { oauth2 } = app.config.cnpmcore;
      const { userInfoUri } = oauth2;
      app.mockHttpclient(`${userInfoUri}?access_token=${mockedAccessToken}`, {
        status: 200,
        data: {
          name: 'nobody',
        },
      });
      const res = await app.httpRequest()
        .get('/-/sso/callback?state=fake_token&code=fake_sso_code')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] User nobody email not exists');
    });

    it('should throw error when access token error', async () => {
      const { oauth2 } = app.config.cnpmcore;
      const { accessTokenUri } = oauth2;
      app.mockHttpclient(accessTokenUri, {
        status: 500,
        data: {},
      });
      await app.httpRequest()
        .get('/-/sso/callback?state=fake_token&code=fake_sso_code')
        .expect(403);
    });

    it('should throw error when sso get user info error', async () => {
      const { oauth2 } = app.config.cnpmcore;
      const { userInfoUri } = oauth2;
      app.mockHttpclient(`${userInfoUri}?access_token=${mockedAccessToken}`, {
        status: 500,
        data: mockUser,
      });
      await app.httpRequest()
        .get('/-/sso/callback?state=fake_token&code=fake_sso_code')
        .expect(403);
    });
  });

});
