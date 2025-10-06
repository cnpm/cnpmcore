import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil, type TestUser } from '../../../../test/TestUtil.js';
import { calculateIntegrity } from '../../../../app/common/PackageUtil.js';
import {
  PackageTagAddedSyncPackageVersionFileEvent,
  PackageTagChangedSyncPackageVersionFileEvent,
} from '../../../../app/core/event/SyncPackageVersionFile.js';

describe('test/port/controller/PackageVersionFileController/raw.test.ts', () => {
  let publisher: TestUser;
  let adminUser: TestUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    publisher = await TestUtil.createUser();
  });

  describe('[GET /:fullname/:versionSpec/files/:path] raw()', () => {
    it('should show one package version raw file', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
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
      let res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });

      // again should work
      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.ok(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });

      // should redirect on tag request
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/latest/files/package.json`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files/package.json`
      );
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/^1.0.0/files/package.json`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files/package.json`
      );
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/%5E1.0.0/files/package.json`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files/package.json`
      );
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
    });

    it('should block raw file when package not in white list', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      let pkg = await TestUtil.getFullPackage({
        name: 'foo-block-again',
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
      let res = await app
        .httpRequest()
        .get('/foo-block-again/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });

      await setTimeout(1);
      mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);
      // should block
      res = await app
        .httpRequest()
        .get('/foo-block-again/1.0.0/files/package.json')
        .expect(403)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(
        res.body.error,
        '[FORBIDDEN] "foo-block-again" is not allow to unpkg files, see https://github.com/cnpm/unpkg-white-list'
      );

      // add white list
      pkg = await TestUtil.getFullPackage({
        name: 'unpkg-white-list',
        version: '2.0.1111',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          allowPackages: {
            'foo-block-again': {
              version: '*',
            },
          },
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      await setTimeout(1);
      res = await app
        .httpRequest()
        .get('/foo-block-again/1.0.0/files/package.json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        name: 'mk2testmodule',
        version: '0.0.1',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        author: '',
        license: 'ISC',
      });
    });

    it('should show one package version file meta', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
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
      let res = await app.httpRequest().get(`/${pkg.name}/1.0.0`).expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json?meta`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/package.json',
        type: 'file',
        contentType: 'application/json',
        integrity:
          'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
        lastModified: publishTime,
        size: 209,
      });

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/latest/files/package.json?meta=2`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files/package.json?meta=2`
      );
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      // file path not exists
      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/package2.json?meta')
        .expect(404);
      assert.ok(!res.headers.etag);
      assert.ok(!res.headers['cache-control']);
      assert.equal(
        res.body.error,
        `[NOT_FOUND] File ${pkg.name}@1.0.0/package2.json not found`
      );
    });

    it('should 422 when invalid spec', async () => {
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const res = await app
        .httpRequest()
        .get('/foo/@invalid-spec/files/package.json?meta')
        .expect(422);

      assert.equal(
        res.body.error,
        '[INVALID_PARAM] must match format "semver-spec"'
      );
    });

    it('should ignore not exists file on tar onentry', async () => {
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/ide-metrics-api-grpc-0.0.1-main-gha.8962.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
    });

    it('should support non-ascii file name', async () => {
      // https://unpkg.com/browse/@ppwcode/openapi@7.3.3/resource/ToOneFrom%CF%87.js
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/openapi-7.3.3.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/resource/`);
      assert.equal(res.status, 200);
      // console.log(res.body);
      assert.ok(
        res.body.files.find(
          (file: { path: string }) => file.path === '/resource/ToOneFromχ.js'
        )
      );
      // res = await app.httpRequest()
      // .get(`/${pkg.name}/1.0.0/files/resource/ToOneFromχ.js`);
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/resource/ToOneFrom%CF%87.js`);
      assert.equal(res.status, 200);
      assert.equal(
        res.headers['content-type'],
        'application/javascript; charset=utf-8'
      );
      // console.log(res.text);
      assert.match(res.text, /ToOneFromχ/);
    });

    it('should support non-npm pack tgz file', async () => {
      // https://github.com/cnpm/cnpmcore/issues/452#issuecomment-1570077310
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/lodash-es-4.17.7.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/lodash-es',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: '',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
      assert.ok(
        res.body.files.find(
          (file: { path: string }) => file.path === '/package.json'
        )
      );
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/zipObjectDeep.d.ts`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert.match(res.text, /export default zipObjectDeep/);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.header.location, `/${pkg.name}/1.0.0/files/index.js`);
    });

    it('should ignore "." hidden dir', async () => {
      // https://unpkg.com/browse/bovo-ui@0.0.4-36/
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/bovo-ui-0.0.4-36.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/bovo-ui',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
      // console.log(res.body);
      assert.equal(
        res.body.files.find((file: { path: string }) => file.path === '/.'),
        undefined
      );
      assert.ok(
        res.body.files.find((file: { path: string }) => file.path === '/dist')
      );
      const packageTagAdded = await app.getEggObject(
        PackageTagAddedSyncPackageVersionFileEvent
      );
      await packageTagAdded.handle(pkg.name, 'foo');
      await packageTagAdded.handle(pkg.name, 'latest');
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0`);
      const readme = res.body.readme;
      assert.match(readme, /# bovo-ui/);
      // pkg readme change to latest
      res = await app.httpRequest().get(`/${pkg.name}`);
      assert.equal(res.body.readme, readme);
    });

    it('should handle big tgz file', async () => {
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/pouchdb-3.2.1.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0`).expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      const oldReadme = res.body.readme;

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert.ok(
        res.body.files.find(
          (file: { path: string }) => file.path === '/CONTRIBUTING.md'
        )
      );
      let testDir = res.body.files.find(
        (file: { path: string }) => file.path === '/tests'
      );
      assert.ok(testDir);
      assert.equal(testDir.files.length, 0);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/');

      // pkg version readme should change
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0`).expect(200);
      assert.notEqual(res.body.readme, oldReadme);
      assert.match(res.body.readme, /The Javascript Database that Syncs/);
      const packageTagChanged = await app.getEggObject(
        PackageTagChangedSyncPackageVersionFileEvent
      );
      await packageTagChanged.handle(pkg.name, 'foo');
      await packageTagChanged.handle(pkg.name, 'latest');
      // pkg version change too
      res = await app.httpRequest().get(`/${pkg.name}`).expect(200);
      assert.match(res.body.readme, /The Javascript Database that Syncs/);

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files?meta=true`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert.ok(
        res.body.files.find(
          (file: { path: string }) => file.path === '/CONTRIBUTING.md'
        )
      );
      testDir = res.body.files.find(
        (file: { path: string }) => file.path === '/tests'
      );
      assert.ok(testDir);
      assert.equal(testDir.files.length, 0);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/');

      // redirect to main file
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files/lib/index.js`
      );

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/lib/index.js`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers['content-type'],
        'application/javascript; charset=utf-8'
      );
      assert.equal(res.headers['transfer-encoding'], 'chunked');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/_site/getting-started.html`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /<!DOCTYPE html>/);

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/_site/getting-started.html?meta`);
      assert.equal(res.status, 200);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8'
      );
      assert.ok(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        path: '/docs/_site/getting-started.html',
        type: 'file',
        contentType: 'text/plain',
        integrity:
          'sha512-o/nCeU2MBJpIWhA8gIbf6YW49Ss3Spga5M70LJjjyRMlALQDmeh8IVMXagAe79l1Yznci/otKtNjWhVMOM38hg==',
        lastModified: publishTime,
        size: 26_716,
      });

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/tests`);
      assert.equal(res.status, 404);
      assert.equal(
        res.body.error,
        '[NOT_FOUND] File @cnpm/foo-tag-latest@1.0.0/tests not found'
      );

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/tests/`);
      assert.equal(res.status, 200);
      // console.log('%o', res.body);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.body.path, '/tests');
      // make sure sub dirs exists
      const integrationDir = res.body.files.find(
        (file: { path: string }) => file.path === '/tests/integration'
      );
      assert.ok(integrationDir);
      assert.equal(integrationDir.files.length, 0);
      assert.equal(integrationDir.type, 'directory');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests/integration/test.http.js`);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers['content-type'],
        'application/javascript; charset=utf-8'
      );
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /describe\(/);

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/tests/integration/test.http.js?meta`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8'
      );
      assert.ok(!res.headers['content-disposition']);
      assert.deepEqual(res.body, {
        path: '/tests/integration/test.http.js',
        type: 'file',
        contentType: 'application/javascript',
        integrity:
          'sha512-yysF4V48yKDI9yWuROuPd9cn9dn3nFQaAGkGMe46l6htQ6ZsoX4SAw9+FkhmmPez2VjxW/lYhWy21R1oOOu8Fw==',
        lastModified: publishTime,
        size: 1917,
      });

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/README.md`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/markdown; charset=utf-8');
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /The Javascript Database that Syncs/);

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/.travis.yml`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'text/yaml; charset=utf-8');
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /language: node_js/);

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/LICENSE`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      // FIXME: should be text/plain
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /Apache License/);

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/.npmignore`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      // FIXME: should be text/plain
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/bin/release.sh`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(res.headers['content-type'], 'application/x-sh');
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /#!\/bin\/bash/);

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/docs/manifest.appcache`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=31536000');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.equal(
        res.headers['content-type'],
        'text/cache-manifest; charset=utf-8'
      );
      assert.ok(!res.headers['content-disposition']);
      assert.equal(res.headers['transfer-encoding'], 'chunked');
      assert.match(res.text, /CACHE MANIFEST/);
    });

    it('should 451 when package block', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests again',
        });
      assert.equal(res.status, 201);
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/index.js`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(
        res.body.error,
        /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/
      );
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      let res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files/foo.json`)
        .expect(404);
      assert.ok(!res.headers.etag);
      assert.ok(!res.headers['cache-control']);
      assert.equal(
        res.body.error,
        `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`
      );

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files/bin/foo/bar.js`)
        .expect(404);
      assert.ok(!res.headers.etag);
      assert.ok(!res.headers['cache-control']);
      assert.equal(
        res.body.error,
        `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`
      );
    });

    it('should include SRI headers when serving raw files', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'sri-test-package',
        version: '1.0.0',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      // Test raw file access includes SRI headers
      const res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200);

      // Should include all SRI headers
      assert.ok(res.headers['x-sri-sha256'], 'Missing X-SRI-SHA256 header');
      assert.ok(res.headers['x-sri-sha384'], 'Missing X-SRI-SHA384 header');
      assert.ok(res.headers['x-sri-sha512'], 'Missing X-SRI-SHA512 header');
      assert.ok(res.headers['x-sri-integrity'], 'Missing X-SRI-Integrity header');

      // Verify header format
      assert.ok(res.headers['x-sri-sha256'].startsWith('sha256-'));
      assert.ok(res.headers['x-sri-sha384'].startsWith('sha384-'));
      assert.ok(res.headers['x-sri-sha512'].startsWith('sha512-'));

      // Combined header should contain all three algorithms
      const combinedHeader = res.headers['x-sri-integrity'];
      assert.ok(combinedHeader.includes('sha256-'));
      assert.ok(combinedHeader.includes('sha384-'));
      assert.ok(combinedHeader.includes('sha512-'));
      
      // Should be space-separated
      const parts = combinedHeader.split(' ');
      assert.equal(parts.length, 3, 'Combined header should have 3 algorithms');
    });

    it('should include SRI data in file metadata response', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'sri-meta-test',
        version: '1.0.0',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      // Test metadata includes SRI object
      const res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json?meta`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert.ok(res.body.sri, 'Response should include sri object');
      assert.ok(res.body.sri.sha256, 'Missing sri.sha256');
      assert.ok(res.body.sri.sha384, 'Missing sri.sha384');
      assert.ok(res.body.sri.sha512, 'Missing sri.sha512');
      assert.ok(res.body.sri.combined, 'Missing sri.combined');

      // Verify format
      assert.ok(res.body.sri.sha256.startsWith('sha256-'));
      assert.ok(res.body.sri.sha384.startsWith('sha384-'));
      assert.ok(res.body.sri.sha512.startsWith('sha512-'));

      // Combined should match the pattern
      assert.equal(
        res.body.sri.combined,
        `${res.body.sri.sha256} ${res.body.sri.sha384} ${res.body.sri.sha512}`
      );

      // Backwards compatibility: integrity field should still be SHA-512
      assert.equal(res.body.integrity, res.body.sri.sha512);
    });

    it('should handle legacy packages with SHA-512 only integrity', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'legacy-package',
        version: '1.0.0',
      });
      
      // Modify the package to simulate legacy format (SHA-512 only)
      // This would happen for packages published before the SRI enhancement
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      // Even with new SRI support, should work correctly
      const res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200);

      // Should still have SRI headers (generated from the file)
      assert.ok(res.headers['x-sri-sha256']);
      assert.ok(res.headers['x-sri-sha384']);
      assert.ok(res.headers['x-sri-sha512']);
      assert.ok(res.headers['x-sri-integrity']);
    });

    it('should maintain backwards compatibility in metadata responses', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'compat-test',
        version: '1.0.0',
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
        .get(`/${pkg.name}/1.0.0/files/package.json?meta`)
        .expect(200);

      // All original fields should still be present
      assert.ok(res.body.path);
      assert.ok(res.body.type);
      assert.ok(res.body.contentType);
      assert.ok(res.body.integrity);
      assert.ok(res.body.lastModified);
      assert.ok(res.body.size);

      // New SRI field should be additional, not replacing
      assert.ok(res.body.sri);
      
      // Primary integrity field should match sri.sha512 for backwards compatibility
      assert.equal(res.body.integrity, res.body.sri.sha512);
    });

    it('should generate consistent SRI values for the same file', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'consistency-test',
        version: '1.0.0',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      // Get the file multiple times
      const res1 = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200);

      const res2 = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200);

      // SRI headers should be identical
      assert.equal(res1.headers['x-sri-sha256'], res2.headers['x-sri-sha256']);
      assert.equal(res1.headers['x-sri-sha384'], res2.headers['x-sri-sha384']);
      assert.equal(res1.headers['x-sri-sha512'], res2.headers['x-sri-sha512']);
      assert.equal(res1.headers['x-sri-integrity'], res2.headers['x-sri-integrity']);

      // Metadata should also be consistent
      const meta1 = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json?meta`)
        .expect(200);

      const meta2 = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json?meta`)
        .expect(200);

      assert.deepEqual(meta1.body.sri, meta2.body.sri);
    });
  });
});
