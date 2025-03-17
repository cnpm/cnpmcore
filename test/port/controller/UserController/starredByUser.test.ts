import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/port/controller/UserController/starredByUser.test.ts', () => {
  describe('[GET /-/_view/starredByUser] starredByUser()', () => {
    it('should 403', async () => {
      const { authorization } = await TestUtil.createUser();
      let res = await app
        .httpRequest()
        .get('/-/_view/starredByUser?key=%22cnpmcore_admin%22')
        .set('authorization', authorization);
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm stars is not allowed');

      res = await app
        .httpRequest()
        .get('/-/_view/starredByUser?key=%22cnpmcore_admin%22');
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm stars is not allowed');
    });
  });
});
