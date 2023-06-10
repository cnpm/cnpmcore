import assert from 'assert';
import crypto from 'crypto';
import { basename } from 'path';
import { app, mock } from 'egg-mock/bootstrap';
import { AuthAdapter } from '../../../app/infra/AuthAdapter';
import { CacheAdapter } from '../../../app/common/adapter/CacheAdapter';
import { UserService } from '../../../app/core/service/UserService';
import { UserRepository } from '../../../app/repository/UserRepository';
import { genRSAKeys, encryptRSA } from '../../../app/common/CryptoUtil';

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

  describe('GET /-/v1/login/request/session/:sessionId', () => {

    let sessionId = '';
    const rsaKeys = genRSAKeys();
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
      await cacheAdapter.set(`${sessionId}_privateKey`, rsaKeys.privateKey);
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

    it('should render login.html', async () => {
      const res = await app.httpRequest()
        .get(`/-/v1/login/request/session/${sessionId}`);

      assert.equal(res.status, 200);
      assert(/<title>Sign in to CNPM<\/title>/.test(res.text));

    });

  });

  describe('POST /-/v1/login/request/session/:sessionId', () => {

    let sessionId = '';
    const rsaKeys = genRSAKeys();
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
      await cacheAdapter.set(`${sessionId}_privateKey`, rsaKeys.privateKey);
    });


    it('should check sessionId type', async () => {
      const res = await app.httpRequest()
        .post('/-/v1/login/request/session/123');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] sessionId: must NOT have fewer than 36 characters');

    });

    it('should check sessionId exists', async () => {
      const res = await app.httpRequest()
        .post(`/-/v1/login/request/session/${crypto.randomUUID()}`);

      assert.equal(res.status, 200);
      assert(/Session not found/.test(res.text));
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');

    });

    describe('should verify login request body', () => {
      beforeEach(async () => {
        const userService = await app.getEggObject(UserService);
        await userService.create({
          name: 'banana',
          email: 'banana@fruits.com',
          password: 'flymetothemoon',
          ip: 'localhost',
        });
      });

      it('should login success', async () => {

        const password = encryptRSA(rsaKeys.publicKey, 'flymetothemoon');
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: 'banana',
              password,
            },
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
      });

      it('should check password', async () => {

        const password = encryptRSA(rsaKeys.publicKey, 'incorrect_password');
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: 'banana',
              password,
            },
          });

        assert.equal(res.status, 200);
        assert(/Please check your login name and password/.test(res.body.message));

      });

      it('should check user params', async () => {

        const password = encryptRSA(rsaKeys.publicKey, 'incorrect_password');
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: '',
              password,
            },
          });

        assert.equal(res.status, 200);
        assert(/Unauthorized, Validation Failed/.test(res.body.message));

      });

      it('should check authentication user (unbound webauthn) when enableWebauthn', async () => {
        mock(app.config.cnpmcore, 'enableWebAuthn', true);
        app.mockContext({
          hostname: 'localhost',
        });
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: 'banana',
            },
            wanCredentialAuthData: {},
          });

        assert.equal(res.status, 200);
        assert(/Unauthorized, Please check your login name/.test(res.body.message));
      });

      it('should add user', async () => {
        const password = encryptRSA(rsaKeys.publicKey, 'newaccount_password');
        const userRepository = await app.getEggObject(UserRepository);
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: 'orange',
              password,
            },
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);

        const user = await userRepository.findUserByName('orange');
        assert(user);
      });

      it('only support admin when not allowPublicRegistration', async () => {
        mock(app.config.cnpmcore, 'allowPublicRegistration', false);
        const password = encryptRSA(rsaKeys.publicKey, 'newaccount_password');
        const res = await app.httpRequest()
          .post(`/-/v1/login/request/session/${sessionId}`)
          .send({
            accData: {
              username: 'orange',
              password,
            },
          });

        assert.equal(res.status, 200);
        assert(/Public registration is not allowed/.test(res.body.message));

      });

    });

  });

  describe('/-/v1/login/request/prepare/:sessionId', () => {
    let sessionId = '';
    const rsaKeys = genRSAKeys();
    beforeEach(async () => {
      sessionId = crypto.randomUUID();
      const cacheAdapter = await app.getEggObject(CacheAdapter);
      await cacheAdapter.set(sessionId, '');
      await cacheAdapter.set(`${sessionId}_privateKey`, rsaKeys.privateKey);
      const userService = await app.getEggObject(UserService);
      const user = await userService.create({
        name: 'banana',
        email: 'banana@fruits.com',
        password: 'flymetothemoon',
        ip: 'localhost',
      });
      await userService.createWebauthnCredential(user.user.userId, {
        credentialId: 'mock_credential_id',
        publicKey: 'mock_public_key',
      });
    });

    it('should check sessionId type', async () => {
      const res = await app.httpRequest()
        .get('/-/v1/login/request/prepare/123?name=banana');

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] sessionId: must NOT have fewer than 36 characters');

    });

    it('should check sessionId exists', async () => {
      const res = await app.httpRequest()
        .get(`/-/v1/login/request/prepare/${crypto.randomUUID()}?name=banana`);

      assert.equal(res.status, 200);
      assert(/Session not found/.test(res.text));
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');

    });

    it('should get prepare with authentication options', async () => {

      const res = await app.httpRequest()
        .get(`/-/v1/login/request/prepare/${sessionId}?name=banana`);

      assert.equal(res.status, 200);
      assert(typeof res.body.wanCredentialAuthOption === 'object');
    });

    it('should get prepare with registration options', async () => {

      const res = await app.httpRequest()
        .get(`/-/v1/login/request/prepare/${sessionId}?name=apple`);

      assert.equal(res.status, 200);
      assert(typeof res.body.wanCredentialRegiOption === 'object');
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
