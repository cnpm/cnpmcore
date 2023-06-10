import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { BugVersion } from '../../../../app/core/entity/BugVersion';
import { BugVersionService } from '../../../../app/core/service/BugVersionService';

describe('test/port/controller/package/ShowPackageVersionController.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[GET /:fullname/:versionSpec] show()', () => {
    it('should show one package version', async () => {
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
      const res = await app.httpRequest()
        .get('/foo/1.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.name, 'foo');
      assert.match(res.body.dist.tarball, /^http:\/\//);
      assert(res.body.dist.tarball.endsWith('/foo/-/foo-1.0.0.tgz'));
      assert.equal(res.body.dist.shasum, 'fa475605f88bab9b1127833633ca3ae0a477224c');
      assert.equal(res.body.dist.integrity, 'sha512-n+4CQg0Rp1Qo0p9a0R5E5io67T9iD3Lcgg6exmpmt0s8kd4XcOoHu2kiu6U7xd69cGq0efkNGWUBP229ObfRSA==');
      assert.equal(res.body.dist.size, 251);
      assert.equal(res.body.description, 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻');

      // support semver spec
      await app.httpRequest()
        .get('/foo/%5E1.0')
        .expect(200);

      await app.httpRequest()
        .get('/foo/^1.0')
        .expect(200);

      // not support alias
      await app.httpRequest()
        .get('/alias-a-pkg/npm:foo@^1.0')
        .expect(422);

      await app.httpRequest()
        .get('/npm/@babel%2fhelper-compilation-targets ')
        .expect(422);
    });

    it('should fix bug version', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkgV1 = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      const pkgV2 = await TestUtil.getFullPackage({
        name: 'foo',
        version: '2.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      const pkgV3 = await TestUtil.getFullPackage({
        name: 'foo',
        version: '3.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      const bugVersion = new BugVersion({
        foo: {
          '2.0.0': {
            version: '1.0.0',
            reason: 'mock reason',
          },
          '3.0.0': {
            version: '3.0.0',
            reason: 'mock reason same version',
          },
        },
      });
      mock(BugVersionService.prototype, 'getBugVersion', async () => {
        return bugVersion;
      });
      await app.httpRequest()
        .put(`/${pkgV1.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgV1)
        .expect(201);
      await app.httpRequest()
        .put(`/${pkgV2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgV2)
        .expect(201);
      await app.httpRequest()
        .put(`/${pkgV3.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgV3)
        .expect(201);
      let res = await app.httpRequest()
        .get('/foo/2.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-1.0.0.tgz');
      assert(res.body.deprecated === '[WARNING] Use 1.0.0 instead of 2.0.0, reason: mock reason');
      // don't change version
      assert(res.body.version === '2.0.0');

      // same version not fix bug version
      res = await app.httpRequest()
        .get('/foo/3.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-3.0.0.tgz');
      assert(!res.body.deprecated);
      assert(res.body.version === '3.0.0');

      // sync worker request should not effect
      res = await app.httpRequest()
        .get(`/${pkgV1.name}/2.0.0?cache=0`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-2.0.0.tgz');
      assert(!res.body.deprecated);
      assert(res.body.version === '2.0.0');
    });

    it('should 422 with invalid spec', async () => {
      const res = await app.httpRequest()
        .get('/foo/@invalid-spec')
        .expect(422)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.error, '[INVALID_PARAM] must match format "semver-spec"');
    });

    it('should work with scoped package', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .expect(200)
        .expect(res => {
          assert(res.body);
        });
    });

    it('should latest tag with scoped package', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert(res.status === 201);
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest`);
      assert(res.status === 200);
      assert(res.body.version === '1.0.0');
      assert(!res.headers['cache-control']);
      assert(res.headers.vary === 'Origin');

      mock(app.config.cnpmcore, 'enableCDN', true);
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest`);
      assert(res.status === 200);
      assert(res.body.version === '1.0.0');
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
    });

    it('should latest tag with not scoped package', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo-tag-latest',
        version: '2.0.0',
        versionObject: {
          description: 'foo latest description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get(`/${pkg.name}/latest`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      res = await app.httpRequest()
        .get(`/${pkg.name}/^2.0.0`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      res = await app.httpRequest()
        .get(`/${pkg.name}/%5E2.0.0`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      // new beta tag
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('2.0.0'))
        .expect(200);
      res = await app.httpRequest()
        .get(`/${pkg.name}/beta`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      // 404 when tag not exists
      res = await app.httpRequest()
        .get(`/${pkg.name}/beta-not-exists`);
      assert.equal(res.status, 404);
      assert(!res.headers.etag);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@beta-not-exists not found`);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      let res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404`)
        .expect(404);
      assert(!res.headers.etag);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);

      // should 404 on syncMode=all when package exists
      mock(app.config.cnpmcore, 'syncMode', 'all');
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404`)
        .expect(404);
      assert(!res.headers.etag);
      assert(res.body.error === `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert(!res.headers.etag);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should not redirect public package version to source registry when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      let res = await app.httpRequest()
        .get('/foonot-not-exists/1.0.40000404')
        .expect(404);
      assert(res.body.error === '[NOT_FOUND] foonot-not-exists not found');

      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      await TestUtil.createPackage({ name: 'foo-exists', isPrivate: false });
      res = await app.httpRequest()
        .get('/foo-exists/1.0.40000404?t=123')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] foo-exists@1.0.40000404 not found');
    });

    it('should not redirect private scope package to source registry when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should not redirect private scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should redirect public scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      let res = await app.httpRequest()
        .get('/@egg/foonot-exists/1.0.40000404');
      assert(res.status === 302);
      assert(!res.headers.etag);
      assert(res.headers.location === 'https://registry.npmjs.org/@egg/foonot-exists/1.0.40000404');

      res = await app.httpRequest()
        .get('/@egg/foonot-exists/1.0.40000404?t=123');
      assert(res.status === 302);
      assert(!res.headers.etag);
      assert(res.headers.location === 'https://registry.npmjs.org/@egg/foonot-exists/1.0.40000404?t=123');
    });

    it('should redirect public non scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404')
        .expect(302);

      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404?t=123')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404?t=123')
        .expect(302);
    });

    it('should show _source_registry_name in version manifest', async () => {
      await TestUtil.createPackage({ name: '@cnpm/foo', version: '1.0.0' });
      const res = await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .expect(200);
      assert(res.body._source_registry_name === 'self');
    });

    it('should show _source_registry_name in version manifest for abbreviated', async () => {
      await TestUtil.createPackage({ name: '@cnpm/foo', version: '1.0.0' });
      const res = await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .set('accept', 'application/vnd.npm.install-v1+json')
        .expect(200);
      assert(res.body._source_registry_name === 'self');
    });
  });
});
