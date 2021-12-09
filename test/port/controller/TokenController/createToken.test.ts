import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/TokenController/createToken.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[POST /-/npm/v1/tokens] createToken()', () => {
    it('should 200', async () => {
      const { authorization, password, ua } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
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
        .set('user-agent', ua)
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
        .set('user-agent', ua)
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
        .set('user-agent', ua)
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
      const { authorization, password, ua } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({ password })
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token \"cnpm_\w+\" can\'t setting/);
    });
  });
});
