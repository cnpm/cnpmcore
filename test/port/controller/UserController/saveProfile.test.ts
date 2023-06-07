import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/UserController/saveProfile.test.ts', () => {
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
