import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { type TestUser, TestUtil } from '../../../../test/TestUtil.js';

describe('test/port/controller/PackageBlockController/unblockPackage.test.ts', () => {
  let adminUser: TestUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
  });

  describe('[DELETE /-/package/:fullname/blocks] unblockPackage()', () => {
    it('should 200 when admin request', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert.ok(res.status === 200);
      assert.ok(res.body.ok === true);

      res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert.ok(res.status === 201);
      assert.ok(res.body.ok === true);
      assert.ok(res.body.id);

      res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert.ok(res.status === 200);
      assert.ok(res.body.ok === true);

      // get blocks
      res = await app.httpRequest().get(`/-/package/${pkg.name}/blocks`);
      assert.ok(res.status === 200);
      assert.ok(res.body.data.length === 0);

      // block again
      res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert.ok(res.status === 201);
      assert.ok(res.body.ok === true);
      res = await app.httpRequest().get(`/-/package/${pkg.name}/blocks`);
      assert.ok(res.status === 200);
      assert.ok(res.body.data.length === 1);

      // unblock gain
      res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert.ok(res.status === 200);
      assert.ok(res.body.ok === true);
      res = await app.httpRequest().get(`/-/package/${pkg.name}/blocks`);
      assert.ok(res.status === 200);
      assert.ok(res.body.data.length === 0);
    });

    it('should 403 block private package', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      const res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert.ok(res.status === 403);
      assert.ok(
        res.body.error ===
          '[FORBIDDEN] Can\'t unblock private package "@cnpm/testmodule"'
      );
    });

    it('should 403 when user is not admin', async () => {
      const user = await TestUtil.createUser();
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      let res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', user.authorization);
      assert.ok(res.status === 403);
      assert.ok(res.body.error === '[FORBIDDEN] Not allow to access');

      res = await app.httpRequest().delete(`/-/package/${pkg.name}/blocks`);
      assert.ok(res.status === 403);
      assert.ok(res.body.error === '[FORBIDDEN] Not allow to access');
    });
  });
});
