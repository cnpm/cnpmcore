import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { PackageRepository } from '../../../../app/repository/PackageRepository';

describe('test/port/controller/package/ShowPackageController.test.ts', () => {
  let ctx: Context;
  let packageRepository: PackageRepository;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    packageRepository = await ctx.getEggObject(PackageRepository);
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
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

    it('should show one package with full manifests', async () => {
      const res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const pkg = res.body;
      assert.equal(pkg.name, name);
      assert.equal(Object.keys(pkg.versions).length, 2);
      // console.log(JSON.stringify(pkg, null, 2));
      const versionOne = pkg.versions['1.0.0'];
      assert.equal(versionOne.dist.unpackedSize, 6497043);
      assert(versionOne._cnpmcore_publish_time);
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

      const res2 = await app.httpRequest()
        .get(`/${name}`)
        .expect(200);
      // etag is same
      assert.equal(res2.headers.etag, res.headers.etag);

      // request with etag
      await app.httpRequest()
        .get(`/${name}`)
        .set('If-None-Match', res.headers.etag)
        .expect(304);

      // remove W/ still work
      const resEmpty = await app.httpRequest()
        .get(`/${name}`)
        .set('if-none-match', res.headers.etag.replace('W/', ''))
        .expect(304);
      assert.equal(resEmpty.text, '');

      // etag not match
      const resNew = await app.httpRequest()
        .get(`/${name}`)
        .set('if-none-match', res.headers.etag.replace('"', '"change'))
        .expect(200);
      assert(resNew.text);

      // HEAD work
      const resHead = await app.httpRequest()
        .head(`/${name}`)
        .expect(200);
      assert(!resHead.text);
      assert.match(resHead.headers.etag, /^W\/"\w{40}"$/);
    });

    it('should show one scoped package with full manifests', async () => {
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
      assert.equal(versionOne.dist.tarball,
        `https://registry.example.com/${scopedName}/-/${name}-1.0.0.tgz`);
    });

    it('should show one package with abbreviated manifests', async () => {
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
      assert(!pkg._rev);
      assert(!pkg._id);
      assert(!versionOne._id);
      assert.equal(versionOne.dist.tarball,
        `https://registry.example.com/${name}/-/${name}-2.0.0.tgz`);
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
      assert(!pkg._rev);
      assert(!pkg._id);
      assert(!versionOne._id);
      assert.equal(versionOne.dist.tarball,
        `https://registry.example.com/${scopedName}/-/${name}-2.0.0.tgz`);
    });

    it('should 404 when package not exists on abbreviated manifest', async () => {
      const res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.equal(data.error, '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');
    });

    it('should 404 when package not exists full manifest', async () => {
      const res = await app.httpRequest()
        .get(`/${scopedName}-not-exists`)
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.equal(data.error, '[NOT_FOUND] @cnpm/testmodule-show-package-not-exists not found');
    });

    it('should abbreviated manifests work with install scripts', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: 'test-module-install-scripts',
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
        name: 'test-module-preinstall-scripts',
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
      assert.equal(versionOne.hasInstallScript, true);

      pkg = await TestUtil.getFullPackage({
        name: 'test-module-postinstall-scripts',
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
      assert.equal(versionOne.hasInstallScript, true);
    });

    it('should abbreviated manifests work when dist not exists', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: 'test-module-mock-dist-not-exists',
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

      const pkgModel = await packageRepository.findPackage('', pkg.name);
      if (pkgModel) {
        await packageRepository.removePacakgeDist(pkgModel, false);
      }

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
        name: 'test-module-mock-dist-not-exists-full-manifests',
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

      const pkgModel = await packageRepository.findPackage('', pkg.name);
      if (pkgModel) {
        await packageRepository.removePacakgeDist(pkgModel, true);
      }

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
      const pkg = await TestUtil.getFullPackage({
        name: 'test-module-mock-dist-not-exists-full-manifests-no-verions',
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

      const pkgEntity = await packageRepository.findPackage('', pkg.name);
      if (pkgEntity) {
        await packageRepository.removePacakgeDist(pkgEntity, true);
        await packageRepository.removePackageVersions(pkgEntity.packageId);
      }

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] test-module-mock-dist-not-exists-full-manifests-no-verions not found');
    });

    it('should abbreviated manifests work when all versions not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: 'test-module-mock-dist-not-exists-abbreviated-manifests-no-verions',
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

      const pkgEntity = await packageRepository.findPackage('', pkg.name);
      if (pkgEntity) {
        await packageRepository.removePacakgeDist(pkgEntity, false);
        await packageRepository.removePackageVersions(pkgEntity.packageId);
      }

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] test-module-mock-dist-not-exists-abbreviated-manifests-no-verions not found');
    });

    it('should redirect to source registry if package not exists when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
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

    it('should not redirect private scope pacakge to source registry if package not exists when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      let res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/cnpmcore not found');

      res = await app.httpRequest()
        .get('/@cnpm/cnpmcore')
        .query({ t: '0123123', foo: 'bar' })
        .set('Accept', 'application/json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/cnpmcore not found');
    });
  });
});
