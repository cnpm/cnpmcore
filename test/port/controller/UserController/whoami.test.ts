import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/UserController/whoami.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
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
