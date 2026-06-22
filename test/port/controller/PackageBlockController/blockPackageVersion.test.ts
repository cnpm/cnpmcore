import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { type TestUser, TestUtil } from '../../../../test/TestUtil.ts';

describe('test/port/controller/PackageBlockController/blockPackageVersion.test.ts', () => {
  let adminUser: TestUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    mock(app.config.cnpmcore, 'enableBlockPackageVersion', true);
  });

  describe('[PUT /-/package/:fullname/blocks/:version] blockPackageVersion()', () => {
    it('should 201 when admin blocks a single version', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });

      let res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', adminUser.authorization)
        .send({ reason: 'bad version' });
      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.id);
      assert.equal(res.body.version, '1.0.0');

      // listed as version-scoped block
      res = await app.httpRequest().get(`/-/package/${pkg.name}/blocks`);
      assert.equal(res.status, 200);
      const block = res.body.data.find((b: { version: string }) => b.version === '1.0.0');
      assert.ok(block);
      assert.equal(block.scope, 'version');

      // direct access to the blocked version => 451
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0`);
      assert.equal(res.status, 451);
      assert.ok(
        res.body.error.startsWith('[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm/testmodule@1.0.0 was blocked, reason: '),
      );

      // the full manifest hides the blocked version + exposes blockVersions
      res = await app.httpRequest().get(`/${pkg.name}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.versions['1.0.0'], undefined);
      assert.ok(res.body.blockVersions['1.0.0'].includes('bad version'));
    });

    it('should release the version again on DELETE', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', adminUser.authorization)
        .send({ reason: 'bad version' });

      const res = await app
        .httpRequest()
        .delete(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', adminUser.authorization);
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const manifest = await app.httpRequest().get(`/${pkg.name}/1.0.0`);
      assert.equal(manifest.status, 200);
      assert.equal(manifest.body.version, '1.0.0');
    });

    it('should 403 when feature is disabled', async () => {
      mock(app.config.cnpmcore, 'enableBlockPackageVersion', false);
      const { pkg } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });
      const res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', adminUser.authorization)
        .send({ reason: 'bad version' });
      assert.equal(res.status, 403);
      assert.equal(res.body.error, '[FORBIDDEN] Block package version feature is not enabled');
    });

    it('should 403 when user is not admin', async () => {
      const user = await TestUtil.createUser();
      const { pkg } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });
      const res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', user.authorization)
        .send({ reason: 'bad version' });
      assert.equal(res.status, 403);
      assert.equal(res.body.error, '[FORBIDDEN] Not allow to access');
    });

    it('should 403 block version of a private package', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: true, version: '1.0.0' });
      const res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks/1.0.0`)
        .set('authorization', adminUser.authorization)
        .send({ reason: 'bad version' });
      assert.equal(res.status, 403);
      assert.equal(res.body.error, '[FORBIDDEN] Can\'t block private package "@cnpm/testmodule"');
    });
  });
});
