import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../TestUtil';

describe('test/port/controller/TokenController.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /-/npm/v1/tokens] listTokens()', () => {
    it('should 401', async () => {
      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', 'Bearer foo-token')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Invalid token');
    });

    it('should 200', async () => {
      const { authorization } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      const tokens = res.body.objects;
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].token.length, 8);
      assert.deepEqual(tokens[0].cidr_whitelist, []);
      assert.equal(tokens[0].readonly, false);
      assert.equal(tokens[0].automation, false);
      assert(tokens[0].created);
      assert(tokens[0].updated);
    });

    it('should 401 when readonly token access', async () => {
      const { authorization } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(401);
      assert.match(res.body.error, /\[UNAUTHORIZED\] Read-only Token \'cnpm_\w+\' can\'t setting/);
    });
  });

  describe('[DELETE /-/npm/v1/tokens/token/:tokenKey] removeToken()', () => {
    it('should 200', async () => {
      const { authorization, password } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({
          password,
        })
        .expect(200);

      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      let tokens = res.body.objects;
      assert.equal(tokens.length, 2);

      await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${tokens[1].key}`)
        .set('authorization', authorization)
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 1);
    });

    it('should 401 when readonly token access', async () => {
      const { authorization, token } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${token}`)
        .set('authorization', authorization)
        .expect(401);
      assert.match(res.body.error, /\[UNAUTHORIZED\] Read-only Token \'cnpm_\w+\' can\'t setting/);
    });
  });

  describe('[POST /-/npm/v1/tokens] createToken()', () => {
    it('should 200', async () => {
      const { authorization, password } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({
          password,
        })
        .expect(200);
      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      let tokens = res.body.objects;
      assert.equal(tokens.length, 2);
      assert.equal(tokens[1].readonly, false);
      assert.equal(tokens[1].automation, false);
      assert.deepEqual(tokens[1].cidr_whitelist, []);

      // readonly
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({
          password,
          readonly: true,
        })
        .expect(200);
      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 3);
      assert.equal(tokens[2].readonly, true);
      assert.equal(tokens[2].automation, false);
      assert.deepEqual(tokens[2].cidr_whitelist, []);

      // automation
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({
          password,
          automation: true,
        })
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 4);
      assert.equal(tokens[3].readonly, false);
      assert.equal(tokens[3].automation, true);
      assert.deepEqual(tokens[3].cidr_whitelist, []);

      // cidr_whitelist
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({
          password,
          automation: true,
          cidr_whitelist: [ '192.168.1.1/24' ],
        })
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 5);
      assert.equal(tokens[4].readonly, false);
      assert.equal(tokens[4].automation, true);
      assert.deepEqual(tokens[4].cidr_whitelist, [ '192.168.1.1/24' ]);
    });

    it('should 401 when readonly token access', async () => {
      const { authorization, password } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .send({ password })
        .expect(401);
      assert.match(res.body.error, /\[UNAUTHORIZED\] Read-only Token \'cnpm_\w+\' can\'t setting/);
    });
  });
});
