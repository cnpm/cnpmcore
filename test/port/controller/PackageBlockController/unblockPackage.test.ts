import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageBlockController/unblockPackage.test.ts', () => {
  let adminUser: any;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
  });

  describe('[DELETE /-/package/:fullname/blocks] unblockPackage()', () => {
    it('should 200 when admin request', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert(res.status === 200);
      assert(res.body.ok === true);

      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 201);
      assert(res.body.ok === true);
      assert(res.body.id);

      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert(res.status === 200);
      assert(res.body.ok === true);

      // get blocks
      res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 200);
      assert(res.body.data.length === 0);

      // block again
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 201);
      assert(res.body.ok === true);
      res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 200);
      assert(res.body.data.length === 1);

      // unblock gain
      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert(res.status === 200);
      assert(res.body.ok === true);
      res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 200);
      assert(res.body.data.length === 0);
    });

    it('should 403 block private package', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization);
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Can\'t unblock private package "@cnpm/testmodule"');
    });

    it('should 403 when user is not admin', async () => {
      const user = await TestUtil.createUser();
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      let res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`)
        .set('authorization', user.authorization);
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to access');

      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to access');
    });
  });
});
