import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../TestUtil';

describe('test/port/controller/UserController.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
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

    it('should create new user, with email', async () => {
      let res = await app.httpRequest()
        .put('/-/user/org.couchdb.user:leo')
        .send({
          name: 'leo',
          password: 'password-is-here',
          type: 'user',
          email: 'leo@example.com',
        })
        .expect(200);
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
        .expect(200);
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
  });

  describe('[GET /-/user/org.couchdb.user::username] showUser()', () => {
    it('should 200 when user authorized', async () => {
      const { authorization, name, email } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}`)
        .set('authorization', authorization)
        .expect(200);
      assert.deepEqual(res.body, {
        _id: `org.couchdb.user:${name}`,
        name,
        email,
      });
    });

    it('should 200 {ok: false} when user unauthorized', async () => {
      const { name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}`)
        .expect(200);
      assert.deepEqual(res.body, { ok: false });
    });
  });

  describe('[GET /-/whoami] whoami()', () => {
    it('should 200', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', authorization)
        .expect(200);
      assert.equal(res.body.username, name);
    });

    it('should unauthorized', async () => {
      let res = await app.httpRequest()
        .get('/-/whoami')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');

      res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', 'Bearer foo-token')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Invalid token');
    });
  });
});
