import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/UserController/saveProfile.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('[POST /-/npm/v1/user] saveProfile()', () => {
    it('should 403', async () => {
      const { authorization } = await TestUtil.createUser();
      let res = await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization);
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm profile set is not allowed');

      res = await app.httpRequest()
        .post('/-/npm/v1/user');
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm profile set is not allowed');
    });
  });
});
