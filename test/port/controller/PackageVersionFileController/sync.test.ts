import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageVersionFileController/sync.test.ts', () => {
  let publisher;
  let adminUser;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    adminUser = await TestUtil.createAdmin();
  });

  describe('[PUT /:fullname/:versionSpec/files] sync()', () => {
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
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put('/foo/1.0.0/files')
        .set('authorization', adminUser.authorization)
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
    });

    it('should work', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0`)
        .expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      res = await app.httpRequest()
        .put('/foo/1.0.0/files')
        .set('authorization', adminUser.authorization)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.deepEqual(res.body, [
        {
          path: '/package.json',
          type: 'file',
          contentType: 'application/json',
          integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
          lastModified: publishTime,
          size: 209,
        },
      ]);
      // again should work
      res = await app.httpRequest()
        .put('/foo/1.0.0/files')
        .set('authorization', adminUser.authorization)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.deepEqual(res.body, [
        {
          path: '/package.json',
          type: 'file',
          contentType: 'application/json',
          integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
          lastModified: publishTime,
          size: 209,
        },
      ]);
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .put('/@cnpm/foonot-exists/1.0.40000404/files')
        .set('authorization', adminUser.authorization)
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists@1.0.40000404 not found');
    });

    it('should 403 when non-admin request', async () => {
      const res = await app.httpRequest()
        .put('/@cnpm/foonot-exists/1.0.40000404/files')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Not allow to access');
    });
  });
});
