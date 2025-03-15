import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

describe('test/port/controller/UserController/loginOrCreateUser.test.ts', () => {
  describe('[PUT /-/user/org.couchdb.user::username] loginOrCreateUser()', () => {
    it('should 422', async () => {
      let res = await app
        .httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          password: 'password-is-here',
          type: 'user',
        })
        .expect(422);
      assert.equal(
        res.body.error,
        "[INVALID_PARAM] must have required property 'name'"
      );
      res = await app
        .httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: '123',
          type: 'user',
        })
        .expect(422);
      assert.equal(
        res.body.error,
        '[INVALID_PARAM] password: must NOT have fewer than 8 characters'
      );
    });

    it('should login fail, without email', async () => {
      const res = await app
        .httpRequest()
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
      const res = await app
        .httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
          email: 'leo@example.com',
        })
        .expect(403);
      assert.equal(
        res.body.error,
        '[FORBIDDEN] Public registration is not allowed'
      );
    });

    it('should admin registration success when allowPublicRegistration = false', async () => {
      mock(app.config.cnpmcore, 'allowPublicRegistration', false);
      const res = await app
        .httpRequest()
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
      let res = await app
        .httpRequest()
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
      res = await app
        .httpRequest()
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
      res = await app
        .httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here-wrong',
          type: 'user',
        })
        .expect(401);
      assert.equal(
        res.body.error,
        '[UNAUTHORIZED] Please check your login name and password'
      );
    });

    it('should create new user, with email when config.cnpmcore.alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      let res = await app
        .httpRequest()
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
      res = await app
        .httpRequest()
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
      res = await app
        .httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here-wrong',
          type: 'user',
        })
        .expect(401);
      assert.equal(
        res.body.error,
        '[UNAUTHORIZED] Please check your login name and password'
      );
    });
  });
});
