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
      console.log(tokens);
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].token.length, 8);
      assert.deepEqual(tokens[0].cidr_whitelist, []);
      assert.equal(tokens[0].readonly, false);
      assert.equal(tokens[0].automation, false);
      assert(tokens[0].created);
      assert(tokens[0].updated);
    });
  });
});
