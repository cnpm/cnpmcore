import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil, type TestUser } from '../../../../test/TestUtil.js';

describe('test/port/controller/PackageVersionFileController/removeFiles.test.ts', () => {
  let publisher: TestUser;
  let adminUser: TestUser;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    adminUser = await TestUtil.createAdmin();
  });

  describe('[DELETE /:fullname/:versionSpec/files] removeFiles()', () => {
    it('should 404 when enableUnpkg = false', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableUnpkg', false);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app
        .httpRequest()
        .delete('/foo/1.0.0/files')
        .set('authorization', adminUser.authorization)
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
    });

    it('should work', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      mock(app.config.cnpmcore, 'enableSyncUnpkgFiles', true);
      app.mockLog();

      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });

      // publish package
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const pkgResponse = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0`)
        .expect(200);
      const publishTime = new Date(pkgResponse.body.publish_time).toISOString();

      // sync package version files
      await app
        .httpRequest()
        .put(`/${pkg.name}/1.0.0/files`)
        .set('authorization', adminUser.authorization)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200);

      // remove package version files
      const packageVersionFilesDeleteResponse = await app
        .httpRequest()
        .delete(`/${pkg.name}/1.0.0/files`)
        .set('authorization', adminUser.authorization)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.deepEqual(packageVersionFilesDeleteResponse.body, [
        {
          path: `/packages/${pkg.name}/1.0.0/files/package.json`,
          type: 'file',
          contentType: 'application/json',
          integrity:
            'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
          lastModified: publishTime,
          size: 209,
        },
      ]);
      app.expectLog(
        `DELETE /${pkg.name}/1.0.0/files] [nfsAdapter:remove] key: /packages/foo/1.0.0/files/package.json`
      );
      app.expectLog(
        `DELETE /${pkg.name}/1.0.0/files] [PackageVersionFileRepository:removePackageVersionFiles:remove] 1 rows in PackageVersionFile`
      );
      app.expectLog(
        `DELETE /${pkg.name}/1.0.0/files] [PackageVersionFileRepository:removePackageVersionFiles:remove] 1 rows in Dist`
      );

      // remove again
      const packageVersionFilesDeleteResponse2 = await app
        .httpRequest()
        .delete(`/${pkg.name}/1.0.0/files`)
        .set('authorization', adminUser.authorization)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.deepEqual(packageVersionFilesDeleteResponse2.body, []);
      app.expectLog(
        `DELETE /${pkg.name}/1.0.0/files] [PackageVersionFileRepository:removePackageVersionFiles:remove] 0 rows in PackageVersionFile`
      );
      app.notExpectLog(
        `DELETE /${pkg.name}/1.0.0/files] [PackageVersionFileRepository:removePackageVersionFiles:remove] 0 rows in Dist`
      );
    });

    it('should 404 when package not exists', async () => {
      const res = await app
        .httpRequest()
        .delete('/@cnpm/foonot-exists/1.0.40000404/files')
        .set('authorization', adminUser.authorization)
        .expect(404);
      assert.equal(
        res.body.error,
        '[NOT_FOUND] @cnpm/foonot-exists@1.0.40000404 not found'
      );
    });

    it('should 403 when non-admin request', async () => {
      const res = await app
        .httpRequest()
        .delete('/@cnpm/foonot-exists/1.0.40000404/files')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Not allow to access');
    });
  });
});
