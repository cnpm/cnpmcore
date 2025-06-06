import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/port/controller/UserController/showProfile.test.ts', () => {
  describe('[GET /-/npm/v1/user] showProfile()', () => {
    it('should 401', async () => {
      const { authorization } = await TestUtil.createUser();
      let res = await app
        .httpRequest()
        .get('/-/npm/v1/user')
        .set('authorization', authorization + 'wrong');
      assert.ok(res.status === 401);
      assert.ok(res.body.error === '[UNAUTHORIZED] Invalid token');

      res = await app.httpRequest().get('/-/npm/v1/user');
      assert.ok(res.status === 401);
      assert.ok(res.body.error === '[UNAUTHORIZED] Login first');
    });

    it('should 200', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app
        .httpRequest()
        .get('/-/npm/v1/user')
        .set('authorization', authorization);
      assert.ok(res.status === 200);
      assert.ok(res.body.name === name);
    });
  });
});
