import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageBlockController/blockPackage.test.ts', () => {
  let adminUser: any;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
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

      // block again should work
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests again',
        });
      assert(res.status === 201);
      assert(res.body.ok === true);
      assert(res.body.id === blockId);

      // get blocks
      res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/blocks`);
      assert(res.status === 200);
      assert(res.body.data.length === 1);
      assert(res.body.data[0].id === blockId);
      assert(res.body.data[0].version === '*');
      assert(res.body.data[0].created);
      assert(res.body.data[0].modified);
      assert(res.body.data[0].reason.includes('only for tests again (operator: cnpmcore_admin/'));

      // request manifests will status 451
      res = await app.httpRequest()
        .get(`/${pkg.name}`);
      assert(res.status === 451);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(res.body.error);
      assert(res.body.error.startsWith('[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm/testmodule was blocked, reason: '));
      assert(res.body.error.includes('only for tests again (operator: cnpmcore_admin/'));

      res = await app.httpRequest()
        .get(`/${pkg.name}/latest`);
      assert.equal(res.status, 451);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(res.body.error);
      assert(res.body.error.startsWith('[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm/testmodule@latest was blocked, reason: '));
      assert(res.body.error.includes('only for tests again (operator: cnpmcore_admin/'));

      // check cdn cache
      mock(app.config.cnpmcore, 'enableCDN', true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`);
      assert(res.status === 451);
      assert(!res.headers.etag);
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert(res.body.error);
      assert(res.body.error.startsWith('[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm/testmodule was blocked, reason: '));
      assert(res.body.error.includes('only for tests again (operator: cnpmcore_admin/'));

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0`);
      assert.equal(res.status, 451);
      assert(!res.headers.etag);
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert(res.body.error);
      assert(res.body.error.startsWith('[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm/testmodule@1.0.0 was blocked, reason: '));
      assert(res.body.error.includes('only for tests again (operator: cnpmcore_admin/'));
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
      assert(res.body.error === '[FORBIDDEN] Not allow to access');

      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .send({
          reason: 'only for tests',
        });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to access');
    });
  });
});
