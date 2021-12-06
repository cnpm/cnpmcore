import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { NFSClientAdapter } from '../../../app/common/adapter/NFSClientAdapter';
import { PackageRepository } from '../../../app/repository/PackageRepository';

describe('test/port/controller/PackageController.test.ts', () => {
  let ctx: Context;
  let nfsClientAdapter: NFSClientAdapter;
  let packageRepository: PackageRepository;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
    packageRepository = await ctx.getEggObject(PackageRepository);
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /:fullname] showPackage()', () => {
    const name = 'testmodule-show-package';
    const scopedName = '@cnpm/testmodule-show-package';
    beforeEach(async () => {
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');
      let pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name: scopedName, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name: scopedName, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
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
  });

  describe('[GET /:fullname/:version] showVersion()', () => {
    it('should show one package version', async () => {
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
        .send(pkg)
        .expect(201);

      await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .expect(200)
        .expect(res => {
          assert(res.body);
        });
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
        .send(pkg)
        .expect(201);

      const res = await app.httpRequest()
        .get('/@cnpm/foo/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foo@1.0.40000404 not found');
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });
  });

  describe('[GET /:fullname/-/:name-:version.tgz] downloadVersionTar()', () => {
    const scopedName = '@cnpm/testmodule-download-version-tar';
    const name = 'testmodule-download-version-tar';
    beforeEach(async () => {
      let pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      pkg = await TestUtil.getFullPackage({ name: scopedName, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should download a version tar redirect to mock cdn success', async () => {
      mock(nfsClientAdapter.client, 'url', (storeKey: string) => {
        return `https://cdn.mock.com${storeKey}`;
      });
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('location', `https://cdn.mock.com/packages/${name}/1.0.0/${name}-1.0.0.tgz`)
        .expect(302);
      await app.httpRequest()
        .get(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('location', `https://cdn.mock.com/packages/${scopedName}/1.0.0/${name}-1.0.0.tgz`)
        .expect(302);
    });

    it('should download a version tar with streaming success', async () => {
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar-1.0.0.tgz"')
        .expect(200);

      await app.httpRequest()
        .get(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar-1.0.0.tgz"')
        .expect(200);
    });

    it('should download non-scope package tar success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'testmodule-download-version-tar222', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);

      await app.httpRequest()
        .get(`/${pkg.name}/-/${pkg.name}-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar222-1.0.0.tgz"')
        .expect(200);
    });

    it('should 422 when version is empty string', async () => {
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-.tgz`)
        .expect(422)
        .expect({
          error: '[UNPROCESSABLE_ENTITY] version("") format invalid',
        });
    });

    it('should 404 when package not exists', async () => {
      await app.httpRequest()
        .get('/testmodule-download-version-tar-not-exists/-/testmodule-download-version-tar-not-exists-1.0.0.tgz')
        .expect(404)
        .expect({
          error: '[NOT_FOUND] testmodule-download-version-tar-not-exists not found',
        });

      await app.httpRequest()
        .get('/@cnpm/testmodule-download-version-tar-not-exists/-/testmodule-download-version-tar-not-exists-1.0.0.tgz')
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar-not-exists not found',
        });
    });

    it('should 404 when package version not exists', async () => {
      await app.httpRequest()
        .get(`/${name}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] testmodule-download-version-tar@1.0.404404 not found',
        });

      await app.httpRequest()
        .get(`/${scopedName}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar@1.0.404404 not found',
        });
    });
  });

  describe('[PUT /:fullname] addVersion()', () => {
    it('should add new version success on scoped package', async () => {
      const name = '@cnpm/publish-package-test';
      const pkg = await TestUtil.getFullPackage({ name, version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg2)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should add new version success', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      // console.log(res.body);

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg2)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should add new version without dist success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'without-dist', version: '0.0.0' });
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].dist = undefined;
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, 'ERROR: No README data found!');
    });

    it('should add new version without readme success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'without-readme', version: '0.0.0', readme: null });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, '');
    });

    it('should add new version without readme(object type) success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'with-readme-object', version: '0.0.0' });
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].readme = { foo: 'bar' };
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, '');
    });

    it('should add new version without description(object type) success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'with-description-object', version: '0.0.0' });
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].description = { foo: 'bar' };
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.description, '');
    });

    it('should add same version throw error', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '99.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/99.0.0`)
        .expect(200);
      assert.equal(res.body.version, '99.0.0');

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ version: '99.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg2)
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] cannot modify pre-existing version: 99.0.0');
    });

    it('should 422 when version format error', async () => {
      const pkg = await TestUtil.getFullPackage({
        version: '1.0.woring-version',
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] version("1.0.woring-version") format invalid');
    });

    it('should 422 when name format error', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: 'excited!',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain special characters ("~\'!()*")');

      pkg = await TestUtil.getFullPackage({
        name: ' leading-space:and:weirdchars',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name cannot contain leading or trailing spaces, name can only contain URL-friendly characters');

      pkg = await TestUtil.getFullPackage({
        name: 'eLaBorAtE-paCkAgE-with-mixed-case-and-more-than-214-characters-----------------------------------------------------------------------------------------------------------------------------------------------------------',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain more than 214 characters, name can no longer contain capital letters');
    });

    it('should 422 when attachment data format invalid', async () => {
      let pkg = await TestUtil.getFullPackage({
        attachment: {
          data: null,
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: 'xyz.ddd!',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: '',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: 'H4sIAAAAAAAAA+2SsWrDMBCGPfspDg2Zine123OyEgeylg6Zau2YR8rVRHEtGkkOg5N0jWaFdujVQAv6W4/7/',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');
    });

    it('should 422 when attachment size not match', async () => {
      const pkg = await TestUtil.getFullPackage({
        attachment: {
          length: 3,
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment size 3 not match download size 251');
    });

    it('should 422 dist.integrity invalid', async () => {
      const pkg = await TestUtil.getFullPackage({
        dist: {
          integrity: 'sha512-n+4CQg0Rp1Qo0p9a0R5E5io67T9iD3Lcgg6exmpmt0s8kd4XcOoHu2kiu6U7xd69c',
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.integrity invalid');
    });

    it('should 422 dist.shasum invalid', async () => {
      const pkg = await TestUtil.getFullPackage({
        dist: {
          integrity: undefined,
          shasum: 'wrongshasum',
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.shasum invalid');
    });

    it('should 422 when name not match pkg.name', async () => {
      const pkg = await TestUtil.getFullPackage();
      const res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] fullname(foo) not match package.name(@cnpm/testmodule)');
    });

    it('should 422 _attachments is empty', async () => {
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: null,
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');
    });

    it('should 422 versions is empty', async () => {
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: {},
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] versions is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: [],
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] versions is empty');
    });

    it('should 422 dist-tags is empty', async () => {
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist-tags is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .send({
          name: 'foo',
          'dist-tags': {},
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] dist-tags is empty');
    });
  });

  describe('[PUT /:fullname/-rev/:rev] updatePackage', () => {
    const scopedName = '@cnpm/testmodule-update-package';
    let rev = '';

    beforeEach(async () => {
      const pkg = await TestUtil.getFullPackage({ name: scopedName });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      rev = res.body.rev;
    });

    it('should 422 when maintainters empty', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [],
        })
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] maintainers: must NOT have fewer than 1 items');
    });

    it('should 422 when some maintainters not exists', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            {
              name: 'foo',
              email: 'foo@bar.com',
            },
          ],
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Maintainer \'foo\' not exists');
    });

    it('should 403 request user is not maintainer', async () => {
      const user = await TestUtil.createUser();
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] \'${user.name}\' not authorized to modify ${scopedName}, please contact maintainers: \'${publisher.name}\'`);
    });

    it('should 200 and get latest maintainers', async () => {
      let res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 1);

      const user = await TestUtil.createUser();
      const user2 = await TestUtil.createUser();
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 3);

      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 2);

      // publisher is remove from maintainers
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] \'${publisher.name}\' not authorized to modify ${scopedName}, please contact maintainers: \'${user.name}, ${user2.name}\'`);
    });
  });
});
