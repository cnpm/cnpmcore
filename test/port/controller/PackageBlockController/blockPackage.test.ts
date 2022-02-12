import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/PackageBlockController/blockPackage.test.ts', () => {
  let adminUser: any;
  let ctx: Context;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[PUT /-/package/:fullname/blocks] blockPackage()', () => {
    it('should 200 when admin request', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 201);
      assert(res.body.ok === true);
      assert(res.body.id);
      const blockId = res.body.id;

      // get blocks
      res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 200);
      assert(res.body.data.length === 1);
      assert(res.body.data[0].id === blockId);
      assert(res.body.data[0].version === '*');
      assert(res.body.data[0].created);
      assert(res.body.data[0].modified);
      assert(res.body.data[0].reason.includes('only for tests (operator: cnpmcore_admin/'));
    });

    it('should 403 block private package', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Can\'t block private package "@cnpm/testmodule"');
    });

    it('should 403 when user is not admin', async () => {
      const user = await TestUtil.createUser();
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', user.authorization)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to block package');

      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to block package');
    });
  });
});
