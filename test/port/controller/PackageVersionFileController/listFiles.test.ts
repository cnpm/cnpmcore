import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageVersionFileController/listFiles.test.ts', () => {
  let publisher;
  let adminUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    publisher = await TestUtil.createUser();
  });

  describe('[GET /:fullname/:versionSpec/files] listFiles()', () => {
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
      let res = await app.httpRequest()
        .get('/foo/1.0.0/files')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
      res = await app.httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
    });

    it('should 404 when empty entry', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          main: '',
          description: 'empty main',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get('/foo/1.0.0/files')
        .expect(302)
        .expect('location', '/foo/1.0.0/files/index.js');

      res = await app.httpRequest()
        .get('/foo/1.0.0/files/index.js')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] File foo@1.0.0/index.js not found');
    });

    it('should 422 when invalid spec', async () => {
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const res = await app.httpRequest()
        .get('/foo/@invalid-spec/files')
        .expect(422);

      assert.equal(res.body.error, '[INVALID_PARAM] must match format "semver-spec"');
    });

    it('should list one package version files', async () => {
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
        .get('/foo/1.0.0')
        .expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      const oldReadme = res.body.readme;
      res = await app.httpRequest()
        .get('/foo/1.0.0/files/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
      // not found README.md file, readme not change
      res = await app.httpRequest()
        .get('/foo/1.0.0')
        .expect(200);
      assert.equal(res.body.readme, oldReadme);

      // again should work
      res = await app.httpRequest()
        .get('/foo/1.0.0/files?meta')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
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
      assert.equal(res.status, 201);
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest`)
        .expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest()
        .get(`/${pkg.name}/^1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest()
        .get(`/${pkg.name}/%5E1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      res = await app.httpRequest()
        .get(`/${pkg.name}/latest/files?meta&foo=bar`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files?meta&foo=bar`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest()
        .get(`/${pkg.name}/latest/files/`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files/`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files?meta=1`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.headers['cache-control'], 'public, s-maxage=600, max-age=60');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity: 'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
    });

    it('should list sub dir files', async () => {
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
        .get('/foo/1.0.0/files/foo/')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] foo@1.0.0/files/foo not found');
    });

    it('should auto sync after version publish', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/unittest-unpkg-demo',
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
      await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
    });

    it('should 451 when package block', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests again',
        });
      assert.equal(res.status, 201);
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files/foo/`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(res.body.error, /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.0/files`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(res.body.error, /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/);
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

      const res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files`)
        .expect(404);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404/files')
        .expect(404);
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists@1.0.40000404 not found');
    });
  });
});
