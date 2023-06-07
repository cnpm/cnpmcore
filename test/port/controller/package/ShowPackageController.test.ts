import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManifestType, PackageRepository } from '../../../../app/repository/PackageRepository';
import { BugVersion } from '../../../../app/core/entity/BugVersion';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { CacheService } from '../../../../app/core/service/CacheService';
import { DistRepository } from '../../../../app/repository/DistRepository';
import { BugVersionService } from '../../../../app/core/service/BugVersionService';

describe('test/port/controller/package/ShowPackageController.test.ts', () => {
  let packageRepository: PackageRepository;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    packageRepository = await app.getEggObject(PackageRepository);
  });

  describe('[GET /:fullname] show()', () => {
    const name = 'testmodule-show-package';
    const scopedName = '@cnpm/testmodule-show-package';
    beforeEach(async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');
      let pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name: scopedName, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name: scopedName, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    describe('should fallback when cache error', async () => {
      it('should fallback when get etag error', async () => {
        app.mockLog();
        mock(CacheService.prototype, 'getPackageEtag', async () => {
          throw new Error('mock get etag error');
        });
        await app.httpRequest()
          .get(`/${name}`)
          .expect(200);

        app.expectLog(/ShowPackageController.show:error/);
      });

      it('should fallback when get getPackageManifests error', async () => {
        app.mockLog();
        mock(CacheService.prototype, 'getPackageEtag', async () => {
          return 'mock-etag';
        });
        mock(CacheService.prototype, 'getPackageManifests', async () => {
          throw new Error('mock get etag error');
        });
        await app.httpRequest()
          .get(`/${name}`)
          .expect(200);

        app.expectLog(/ShowPackageController.show:error/);
      });
    });

    it('should show one package with full manifests', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert(pkg.name === name);
      assert(pkg.readme);
      assert(Object.keys(pkg.versions).length === 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['1.0.0'];
      assert.equal(versionOne.dist.unpackedSize, 6497043);
      assert(versionOne._cnpmcore_publish_time);
      assert(versionOne.publish_time);
      assert.equal(pkg._id, name);
      assert(pkg._rev);
      assert(versionOne._id);
      assert.equal(versionOne.dist.tarball,
        `https://registry.example.com/${name}/-/${name}-1.0.0.tgz`);
      // should has etag
      assert.match(res.headers.etag, /^W\/"\w{40}"$/);
      // maintainers
      const maintainers = pkg.maintainers;
      assert.deepEqual(maintainers, [
        {
          name: publisher.name,
          email: publisher.email,
        },
      ]);

      let res2 = await app.httpRequest()
        .get(`/${name}`)
        .expect(200);
      // etag is same
      assert.equal(res2.headers.etag, res.headers.etag);

      // request with etag
      mock(app.config.cnpmcore, 'enableCDN', false);
      await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .expect('vary', 'Origin')
        .expect(304);
      // ignore sync request
      res2 = await app.httpRequest()
        .get(`/${name}?cache=0`)
        .set('If-None-Match', res.headers.etag)
        .expect('vary', 'Origin')
        .expect(200);
      assert(res2.body.name);
      assert.equal(res2.headers.etag, res.headers.etag);
      res2 = await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .set('user-agent', 'npm_service.cnpmjs.org/1.0.0')
        .expect('vary', 'Origin')
        .expect(200);
      assert(res2.body.name);
      assert.equal(res2.headers.etag, res.headers.etag);

      mock(app.config.cnpmcore, 'enableCDN', true);
      await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .expect('vary', 'Origin, Accept, Accept-Encoding')
        .expect(304);

      // application/vnd.npm.install-v1+json request should not same etag
      mock(app.config.cnpmcore, 'enableCDN', false);
      res2 = await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res2.status === 200);
      assert(!res2.body.readme);
      assert(res2.headers.vary === 'Origin');

      mock(app.config.cnpmcore, 'enableCDN', true);
      res2 = await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res2.status === 200);
      assert(!res2.body.readme);
      assert(res2.headers.vary === 'Origin, Accept, Accept-Encoding');

      // remove W/ still work
      mock(app.config.cnpmcore, 'enableCDN', false);
      let resEmpty = await app.httpRequest()
        .get(`/${name}`)
        .set('if-none-match', res.headers.etag.replace('W/', ''))
        .expect(304);
      assert.equal(resEmpty.text, '');
      assert(resEmpty.headers.vary === 'Origin');

      mock(app.config.cnpmcore, 'enableCDN', true);
      resEmpty = await app.httpRequest()
        .get(`/${name}`)
        .set('if-none-match', res.headers.etag.replace('W/', ''))
        .expect(304);
      assert.equal(resEmpty.text, '');
      assert(resEmpty.headers.vary === 'Origin, Accept, Accept-Encoding');

      // etag not match
      const resNew = await app.httpRequest()
        .get(`/${name}`)
        .set('if-none-match', res.headers.etag.replace('"', '"change'))
        .expect(200);
      assert(resNew.text);
      assert(resNew.headers['content-type'] === 'application/json; charset=utf-8');
      assert(resNew.body.name === name);

      // HEAD work
      const resHead = await app.httpRequest()
        .head(`/${name}`)
        .expect(200);
      assert(!resHead.text);
      assert.match(resHead.headers.etag, /^W\/"\w{40}"$/);

      // new version, cache should update
      const pkgNew = await TestUtil.getFullPackage({ name, version: '101.0.1' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgNew)
        .expect(201);
      await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .expect(200);
    });

    it('should show one scoped package with full manifests', async () => {
      const res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert(pkg.name === scopedName);
      assert(Object.keys(pkg.versions).length === 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['1.0.0'];
      assert(versionOne.dist.unpackedSize === 6497043);
      assert(versionOne._cnpmcore_publish_time);
      assert.equal(typeof versionOne._cnpmcore_publish_time, 'string');
      assert(versionOne.publish_time);
      assert.equal(typeof versionOne.publish_time, 'number');
      assert(pkg._id === scopedName);
      assert(pkg._rev);
      assert(versionOne._id);
      assert(versionOne.dist.tarball === `https://registry.example.com/${scopedName}/-/${name}-1.0.0.tgz`);
      assert(!res.headers['cache-control']);
      assert(res.headers.vary === 'Origin');
    });

    it('should show one scoped package with full manifests with CDN enable', async () => {
      mock(app.config.cnpmcore, 'enableCDN', true);
      const res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert.equal(pkg.name, scopedName);
      assert.equal(Object.keys(pkg.versions).length, 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['1.0.0'];
      assert.equal(versionOne.dist.unpackedSize, 6497043);
      assert(versionOne._cnpmcore_publish_time);
      assert.equal(pkg._id, scopedName);
      assert(pkg._rev);
      assert(versionOne._id);
      assert(versionOne.dist.tarball === `https://registry.example.com/${scopedName}/-/${name}-1.0.0.tgz`);
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
    });

    it('should show one package with abbreviated manifests', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get(`/${name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert.equal(pkg.name, name);
      assert.equal(Object.keys(pkg.versions).length, 2);
      assert.match(pkg.modified, /^202\d/);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['2.0.0'];
      assert.equal(versionOne.dist.unpackedSize, 6497043);
      assert(!versionOne._cnpmcore_publish_time);
      assert(versionOne.publish_time);
      assert.equal(typeof versionOne.publish_time, 'number');
      assert(!pkg._rev);
      assert(!pkg._id);
      assert(!versionOne._id);
      assert.equal(versionOne.dist.tarball,
        `https://registry.example.com/${name}/-/${name}-2.0.0.tgz`);

      // request with etag
      await app.httpRequest()
        .get(`/${name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .set('If-None-Match', res.headers.etag)
        .expect(304);

      // remove W/ still work
      const resEmpty = await app.httpRequest()
        .get(`/${name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .set('if-none-match', res.headers.etag.replace('W/', ''))
        .expect(304);
      assert.equal(resEmpty.text, '');

      // etag not match
      const resNew = await app.httpRequest()
        .get(`/${name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .set('if-none-match', res.headers.etag.replace('"', '"change'))
        .expect(200);
      assert(resNew.text);
      assert(resNew.headers['content-type'] === 'application/json; charset=utf-8');
      assert(resNew.body.name === name);

      // HEAD work
      const resHead = await app.httpRequest()
        .head(`/${name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200);
      assert(!resHead.text);
      assert.match(resHead.headers.etag, /^W\/"\w{40}"$/);

      // new version, cache should update
      const pkgNew = await TestUtil.getFullPackage({ name, version: '101.0.1' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgNew)
        .expect(201);
    });

    it('should show one scoped package with abbreviated manifests', async () => {
      const res = await app.httpRequest()
        .get(`/${scopedName}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert.equal(pkg.name, scopedName);
      assert.equal(Object.keys(pkg.versions).length, 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['2.0.0'];
      assert.equal(versionOne.dist.unpackedSize, 6497043);
      assert(!versionOne._cnpmcore_publish_time);
      assert(versionOne.publish_time);
      assert.equal(typeof versionOne.publish_time, 'number');
      assert(!pkg._rev);
      assert(!pkg._id);
      assert(!versionOne._id);
      assert(versionOne.dist.tarball === `https://registry.example.com/${scopedName}/-/${name}-2.0.0.tgz`);
      assert(!res.headers['cache-control']);
      assert(res.headers.vary === 'Origin');
    });

    it('should show one scoped package with abbreviated manifests with CDN enable', async () => {
      mock(app.config.cnpmcore, 'enableCDN', true);
      const res = await app.httpRequest()
        .get(`/${scopedName}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert(pkg.name === scopedName);
      assert(Object.keys(pkg.versions).length === 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['2.0.0'];
      assert(versionOne.dist.unpackedSize === 6497043);
      assert(!versionOne._cnpmcore_publish_time);
      assert(versionOne.publish_time);
      assert.equal(typeof versionOne.publish_time, 'number');
      assert(!pkg._rev);
      assert(!pkg._id);
      assert(!versionOne._id);
      assert(versionOne.dist.tarball === `https://registry.example.com/${scopedName}/-/${name}-2.0.0.tgz`);
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
    });

    it('should 404 when package not exists on abbreviated manifest', async () => {
      let res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      let data = res.body;
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(data.error === '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');

      // should not set cdn cache header
      mock(app.config.cnpmcore, 'enableCDN', true);
      res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(data.error === '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');
    });

    it('should 404 when package not exists full manifest', async () => {
      let res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      let data = res.body;
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(data.error === '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');

      // should not set cdn cache header
      mock(app.config.cnpmcore, 'enableCDN', true);
      res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert(!res.headers.etag);
      assert(!res.headers['cache-control']);
      assert(data.error === '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');
    });

    it('should abbreviated manifests work with install scripts', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-module-install-scripts',
        version: '1.0.0',
        versionObject: {
          scripts: {
            install: 'echo hi',
          },
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      pkg = res.body;
      let versionOne = pkg.versions[Object.keys(pkg.versions)[0]];
      assert.equal(versionOne.hasInstallScript, true);

      pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-module-preinstall-scripts',
        version: '1.0.0',
        versionObject: {
          scripts: {
            preinstall: 'echo hi',
          },
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      pkg = res.body;
      versionOne = pkg.versions[Object.keys(pkg.versions)[0]];
      assert(versionOne.hasInstallScript === true);

      pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-module-postinstall-scripts',
        version: '1.0.0',
        versionObject: {
          scripts: {
            postinstall: 'echo hi',
          },
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      pkg = res.body;
      versionOne = pkg.versions[Object.keys(pkg.versions)[0]];
      assert(versionOne.hasInstallScript === true);
    });

    it('should abbreviated manifests work when dist not exists', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-module-mock-dist-not-exists',
        version: '1.0.0',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkgModel = await packageRepository.findPackage('@cnpm', 'test-module-mock-dist-not-exists');
      await packageRepository.removePackageDist(pkgModel!, false);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      pkg = res.body;
      const versionOne = pkg.versions[Object.keys(pkg.versions)[0]];
      assert(!versionOne.hasInstallScript);
      assert.equal(versionOne.version, '1.0.0');
    });

    it('should full manifests work when dist not exists', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-module-mock-dist-not-exists-full-manifests',
        version: '1.0.0',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkgModel = await packageRepository.findPackage('@cnpm', 'test-module-mock-dist-not-exists-full-manifests');
      await packageRepository.removePackageDist(pkgModel!, true);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      pkg = res.body;
      const versionOne = pkg.versions[Object.keys(pkg.versions)[0]];
      assert(!versionOne.hasInstallScript);
      assert.equal(versionOne.version, '1.0.0');
    });

    it('should full manifests work when all versions not exists', async () => {
      const name = 'test-module-mock-dist-not-exists-full-manifests-no-verions';
      const pkg = await TestUtil.getFullPackage({
        name: `@cnpm/${name}`,
        version: '1.0.0',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkgEntity = await packageRepository.findPackage('@cnpm', name);
      assert(pkgEntity);
      await packageRepository.removePackageDist(pkgEntity, true);
      await packageRepository.removePackageVersions(pkgEntity.packageId);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/json')
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.status === 404);
      assert(res.body.error === `[NOT_FOUND] @cnpm/${name} not found`);
    });

    it('should abbreviated manifests work when all versions not exists', async () => {
      const name = 'test-module-mock-dist-not-exists-abbreviated-manifests-no-verions';
      const pkg = await TestUtil.getFullPackage({
        name: `@cnpm/${name}`,
        version: '1.0.0',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkgEntity = await packageRepository.findPackage('@cnpm', name);
      assert(pkgEntity);
      await packageRepository.removePackageDist(pkgEntity, false);
      await packageRepository.removePackageVersions(pkgEntity.packageId);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.status === 404);
      assert(res.body.error === `[NOT_FOUND] @cnpm/${name} not found`);
    });

    it('should redirect to source registry if public package not exists when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      await app.httpRequest()
        .get('/123')
        .expect('location', 'https://registry.npmjs.org/123')
        .expect(302);

      await app.httpRequest()
        .get('/cnpmcore')
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect('location', 'https://registry.npmjs.org/cnpmcore')
        .expect(302);

      await app.httpRequest()
        .get('/cnpmcore')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json')
        .expect('location', 'https://registry.npmjs.org/cnpmcore?t=0123123&foo=bar')
        .expect(302);

      await app.httpRequest()
        .get('/@eggjs/cnpmcore')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json')
        .expect('location', 'https://registry.npmjs.org/@eggjs/cnpmcore?t=0123123&foo=bar')
        .expect(302);
    });

    it('should not redirect to source registry if public package not exists when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/123');
      assert(res.status === 404);
      assert(res.body.error === '[NOT_FOUND] 123 not found');
    });

    it('should not redirect private scope package to source registry if package not exists when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      let res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.status === 404);
      assert(res.body.error === '[NOT_FOUND] @cnpm/cnpmcore not found');

      res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.body.error === '[NOT_FOUND] @cnpm/cnpmcore not found');
    });

    it('should not redirect private scope package to source registry if package not exists when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      let res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.body.error === '[NOT_FOUND] @cnpm/cnpmcore not found');

      res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(res.body.error === '[NOT_FOUND] @cnpm/cnpmcore not found');
    });

    it('should redirect public scope package to source registry if package not exists when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      let res = await app.httpRequest()
        .get('/@eggjs/tegg-metadata')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/@eggjs/tegg-metadata');

      res = await app.httpRequest()
        .get('/@eggjs/tegg-metadata')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/@eggjs/tegg-metadata?t=0123123&foo=bar');
    });

    it('should not redirect to source registry when redirectNotFound is false and sync mode is none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app.httpRequest()
        .get('/@eggjs/tegg-metadata')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 404);
    });

    it('should redirect public non-scope package to source registry if package not exists when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      let res = await app.httpRequest()
        .get('/egg')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/egg');

      res = await app.httpRequest()
        .get('/egg')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/egg?t=0123123&foo=bar');
    });

    it('should fix bug version', async () => {
      const bugVersion = new BugVersion({
        'testmodule-show-package': {
          '2.0.0': {
            version: '1.0.0',
            reason: 'mock reason',
          },
        },
      });
      mock(BugVersionService.prototype, 'getBugVersion', async () => {
        return bugVersion;
      });
      mock(CacheService.prototype, 'getPackageEtag', async () => {
        return null;
      });
      let res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const shouldFixVersion = res.body.versions['2.0.0'];
      assert(shouldFixVersion.dist.tarball === 'https://registry.example.com/testmodule-show-package/-/testmodule-show-package-1.0.0.tgz');
      assert(shouldFixVersion.deprecated === '[WARNING] Use 1.0.0 instead of 2.0.0, reason: mock reason');
      // don't change version
      assert(shouldFixVersion.version === '2.0.0');

      // sync worker request should not effect
      res = await app.httpRequest()
        .get(`/${name}?cache=0`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const orginalVersion = res.body.versions['2.0.0'];
      assert(orginalVersion.dist.tarball === 'https://registry.example.com/testmodule-show-package/-/testmodule-show-package-2.0.0.tgz');
      assert(!orginalVersion.deprecated);
      assert(orginalVersion.version === '2.0.0');
    });

    it('should show _source_registry_name', async () => {
      mock(CacheService.prototype, 'getPackageEtag', async () => {
        return null;
      });
      const res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      const data = res.body as PackageManifestType;
      assert(data._source_registry_name === 'self');
      assert(Object.values(data.versions).every(v => v!._source_registry_name === 'self'));
    });

    it('should show _source_registry_name for abbreviated', async () => {
      mock(CacheService.prototype, 'getPackageEtag', async () => {
        return null;
      });
      const res = await app.httpRequest()
        .get(`/${name}`)
        .set('accept', 'application/vnd.npm.install-v1+json')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      const data = res.body as PackageManifestType;
      assert(Object.values(data.versions).every(v => v!._source_registry_name === 'self'));
    });

    it('should not throw error if no versions', async () => {
      const bugVersion = new BugVersion({
        'testmodule-show-package': {
          '2.0.0': {
            version: '1.0.0',
            reason: 'mock reason',
          },
        },
      });
      mock(PackageManagerService.prototype, 'getBugVersion', async () => {
        return bugVersion;
      });
      mock(CacheService.prototype, 'getPackageEtag', async () => {
        return null;
      });
      mock(DistRepository.prototype, 'readDistBytesToJSON', async () => {
        return {
          _attachments: {},
          _id: 'testmodule-show-package',
          _rev: '1-624cf5666f33a300c1585d6b',
          author: '',
          description: 'this is a module description',
          name: 'testmodule-show-package',
          readme: 'ERROR: No README data found!',
          time: {
            created: '2022-04-06T02:05:26.539Z',
            modified: '2022-04-06T02:05:26.696Z',
            unpublished: '2022-03-28T06:23:55.136Z',
          },
        };
      });
      await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
    });

    it('should create sync task if package not exists when syncNotFound=true', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      mock(app.config.cnpmcore, 'syncNotFound', true);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app.httpRequest()
        .get('/lodash')
        .set('user-agent', publisher.ua + ' node/16.0.0')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 404);
      // app.expectLog('[middleware:ErrorHandler][syncPackage] create sync package');
    });

    it('should redirect public non-scope package to source registry if package not exists when redirectNotFound=true', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      mock(app.config.cnpmcore, 'syncNotFound', false);
      mock(app.config.cnpmcore, 'redirectNotFound', true);
      const res = await app.httpRequest()
        .get('/egg')
        .set('user-agent', publisher.ua + ' node/16.0.0')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/egg');
    });
  });
});
