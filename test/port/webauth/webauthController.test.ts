import assert from 'assert';
import crypto from 'crypto';
import { basename } from 'path';
import { app, mock } from 'egg-mock/bootstrap';
import { AuthAdapter } from 'app/infra/AuthAdapter';
import { CacheAdapter } from 'app/common/adapter/CacheAdapter';
import { UserService } from 'app/core/service/UserService';
import { UserRepository } from 'app/repository/UserRepository';

describe('test/port/webauth/webauthController.test.ts', () => {
  describe('/-/v1/login', () => {
    it('should get authUrl work', async () => {
      const res = await app.httpRequest()
        .post('/-/v1/login')
        .send({
          hostname: 'test',
        });

      assert.equal(res.status, 200);
      assert(res.body.loginUrl);
      assert(res.body.doneUrl);
      const loginSessionId = basename(res.body.loginUrl);
      const doneSessionId = basename(res.body.doneUrl);
      assert.equal(loginSessionId, doneSessionId);
      assert.equal(loginSessionId.length, 36);
    });

    it('should check hostname', async () => {
      const res = await app.httpRequest()
        .post('/-/v1/login');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, "[INVALID_PARAM] must have required property 'hostname'");

    });

  });

  describe('/-/v1/login/request/session/:sessionId', () => {

    let sessionId = '';
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
    });


    it('should check sessionId type', async () => {
      const res = await app.httpRequest()
        .get('/-/v1/login/request/session/123');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] sessionId: must NOT have fewer than 36 characters');

    });

    it('should check sessionId exists', async () => {
      const res = await app.httpRequest()
        .get(`/-/v1/login/request/session/${crypto.randomUUID()}`);

      assert.equal(res.status, 404);
      assert(/Session not found/.test(res.text));
      assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');

    });

    it('should require authorization', async () => {
      const res = await app.httpRequest()
        .get(`/-/v1/login/request/session/${sessionId}`);

      assert.equal(res.status, 401);
      assert.equal(res.headers['www-authenticate'], 'Basic realm="Login to cnpmcore"');
      assert.equal(res.text, 'Unauthorized');

    });

    it('should check basic authorization', async () => {
      const res = await app.httpRequest()
        .get(`/-/v1/login/request/session/${sessionId}`)
        .set('authorization', 'banana');

      assert.equal(res.status, 401);
      assert.equal(res.headers['www-authenticate'], 'Basic realm="Login to cnpmcore"');
      assert.equal(res.text, 'Unauthorized, invalid authorization, only support "Basic" authorization');

    });

    describe('should verify base64string', () => {
      let authorization = '';
      beforeEach(async () => {
        const userService = await app.getEggObject(UserService);
        await userService.create({
          name: 'banana',
          email: 'banana@fruits.com',
          password: 'flymetothemoon',
          ip: 'localhost',
        });
        authorization = `Basic ${Buffer.from('banana:flymetothemoon', 'utf-8').toString('base64')}`;
      });

      it('should login success', async () => {

        const res = await app.httpRequest()
          .get(`/-/v1/login/request/session/${sessionId}`)
          .set('authorization', authorization);

        assert.equal(res.status, 302);
        assert.equal(res.headers.location, '/-/v1/login/request/success');
      });

      it('should check password', async () => {

        const res = await app.httpRequest()
          .get(`/-/v1/login/request/session/${sessionId}`)
          .set('authorization', `Basic ${Buffer.from('banana:let_me_play_with_the_star', 'utf-8').toString('base64')}`);

        assert.equal(res.status, 401);
        assert(/Please check your login name and password/.test(res.text));

      });

      it('should check user params', async () => {

        const res = await app.httpRequest()
          .get(`/-/v1/login/request/session/${sessionId}`)
          .set('authorization', `Basic ${Buffer.from('apple', 'utf-8').toString('base64')}`);

        assert.equal(res.status, 401);
        assert.equal(res.text, 'Unauthorized, Validation Failed');

      });


      it('should add user', async () => {
        const userRepository = await app.getEggObject(UserRepository);
        const res = await app.httpRequest()
          .get(`/-/v1/login/request/session/${sessionId}`)
          .set('authorization', `Basic ${Buffer.from('orange:let_me_play_with_the_star', 'utf-8').toString('base64')}`);

        assert.equal(res.status, 302);
        assert.equal(res.headers.location, '/-/v1/login/request/success');

        const user = await userRepository.findUserByName('orange');
        assert(user);
      });

      it('only support admin when not allowPublicRegistration', async () => {
        mock(app.config.cnpmcore, 'allowPublicRegistration', false);
        const res = await app.httpRequest()
          .get(`/-/v1/login/request/session/${sessionId}`)
          .set('authorization', authorization);

        assert.equal(res.status, 403);
        assert(/Public registration is not allowed/.test(res.text));

      });

    });

  });

  describe('/-/v1/login/sso/:sessionId', () => {

    let sessionId = '';
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
      mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
        return {
          name: 'banana',
          email: 'banana@fruits.com',
        };
      });
    });

    it('should sso login work', async () => {

      const res = await app.httpRequest()
        .post(`/-/v1/login/sso/${sessionId}`);

      assert.equal(res.status, 200);
    });

    it('should check sessionId exists', async () => {

      const res = await app.httpRequest()
        .post('/-/v1/login/sso/banana');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] sessionId: must NOT have fewer than 36 characters');
    });

    it('should ensure sessionId valid', async () => {
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.delete(sessionId);
      const res = await app.httpRequest()
        .post(`/-/v1/login/sso/${sessionId}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.error, '[FORBIDDEN] invalid sessionId');
    });

    it('should error when invalid userinfo', async () => {
      mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
        return null;
      });
      const res = await app.httpRequest()
        .post(`/-/v1/login/sso/${sessionId}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.error, '[FORBIDDEN] invalid user info');
    });

  });

  describe('/-/v1/login/request/success', () => {

    it('should work', async () => {

      const res = await app.httpRequest()
        .get('/-/v1/login/request/success');

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
      assert(/Authorization Successful/.test(res.text));

    });
  });

  describe('/-/v1/login/done/session/:sessionId', () => {

    let sessionId = '';
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
    });


    it('should check sessionId type', async () => {

      const res = await app.httpRequest()
        .get('/-/v1/login/done/session/123');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] sessionId: must NOT have fewer than 36 characters');

    });

    it('should check sessionId exists', async () => {

      const res = await app.httpRequest()
        .get(`/-/v1/login/done/session/${crypto.randomUUID()}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, '[NOT_FOUND] session not found');

    });

    it('should re-validate sessionId', async () => {

      const res = await app.httpRequest()
        .get(`/-/v1/login/done/session/${sessionId}`);

      assert.equal(res.status, 202);
      assert.equal(res.body.message, 'processing');
      assert.equal(res.headers['retry-after'], 1);

    });

    it('should check sessionId exists', async () => {

      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, 'banana');
      const res = await app.httpRequest()
        .get(`/-/v1/login/done/session/${sessionId}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.token, 'banana');

      assert(await cacheAdapter.get(sessionId) === null);

    });
  });
});
