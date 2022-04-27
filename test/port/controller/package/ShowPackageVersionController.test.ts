import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { BugVersion } from '../../../../app/core/entity/BugVersion';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';

describe('test/port/controller/package/ShowPackageVersionController.test.ts', () => {
  let ctx: Context;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('[GET /:fullname/:versionOrTag] show()', () => {
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
    });

    describe.only('should fix bug version', () => {
      beforeEach(() => {
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      });

      async function initPkg(pkgData, bugVersionData) {
        const pkgList = [].concat(pkgData);
        for (const item of pkgList) {
          const pkg = await TestUtil.getFullPackage(item);
          await app.httpRequest()
            .put(`/${pkg.name}`)
            .set('authorization', publisher.authorization)
            .set('user-agent', publisher.ua)
            .send(pkg)
            .expect(201);
        }

        mock(PackageManagerService.prototype, 'getBugVersion', async () => {
          return new BugVersion(bugVersionData);
        });

        return pkgList;
      }

      it('should change version', async () => {
        const pkgData = [{
          name: 'foo',
          version: '1.0.0',
        }, {
          name: 'foo',
          version: '2.0.0',
        }];

        const bugVersionData = {
          foo: {
            '2.0.0': {
              version: '1.0.0',
              reason: 'mock reason',
            },
          },
        };

        await initPkg(pkgData, bugVersionData);

        let res = await app.httpRequest()
          .get('/foo/2.0.0')
          .expect(200);

        assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-1.0.0.tgz');
        assert(res.body.deprecated === '[WARNING] Use 1.0.0 instead of 2.0.0, reason: mock reason');
        // don't change version
        assert(res.body.version === '2.0.0');

        // sync worker request should not effect
        res = await app.httpRequest()
          .get('/foo/2.0.0?cache=0')
          .expect(200);
        assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-2.0.0.tgz');
        assert(!res.body.deprecated);
        assert(res.body.version === '2.0.0');
      });

      it('should not change version due to same version', async () => {
        const pkgData = {
          name: 'foo',
          version: '3.0.0',
        };

        const bugVersionData = {
          foo: {
            '3.0.0': {
              version: '3.0.0',
              reason: 'mock reason same version',
            },
          },
        };

        await initPkg(pkgData, bugVersionData);

        const res = await app.httpRequest()
          .get('/foo/3.0.0')
          .expect(200);

        assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-3.0.0.tgz');
        assert(!res.body.deprecated);
        assert(res.body.version === '3.0.0');
      });

      it.only('should override scripts', async () => {
        const pkgData = [{
          name: 'foo',
          version: '4.0.0',
        }, {
          name: 'foo',
          version: '4.1.0',
          scripts: {
            lint: 'echo "lint"',
            postinstall: 'echo "postinstall"',
          },
        }];

        const bugVersionData = {
          foo: {
            '4.1.0': {
              version: '4.0.0',
              reason: 'evil scripts',
              scripts: {
                postinstall: '',
              },
            },
          },
        };

        const pkgData1 = await initPkg(pkgData, bugVersionData);
        console.log(pkgData1)

        const res = await app.httpRequest()
          .get('/foo/4.1.0')
          .expect(200);

        assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-4.0.0.tgz');
        assert(res.body.deprecated === '[WARNING] Override scripts [postinstall], reason: evil scripts');
        assert(res.body.scripts.lint === 'echo "lint"');
        assert(res.body.scripts.postinstall === '');
        // don't change version
        assert(res.body.version === '4.1.0');
      });
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
      const pkgV4 = await TestUtil.getFullPackage({
        name: 'foo',
        version: '4.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
        scripts: {
          test: 'echo "test"',
          postinstall: 'echo "postinstall"',
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
          '4.0.0': {
            version: '4.0.0',
            reason: 'evil scripts',
            scripts: {
              postinstall: '',
            },
          },
        },
      });
      mock(PackageManagerService.prototype, 'getBugVersion', async () => {
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
      await app.httpRequest()
        .put(`/${pkgV4.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgV4)
        .expect(201);

      console.log('checking /foo/2.0.0');
      let res = await app.httpRequest()
        .get('/foo/2.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-1.0.0.tgz');
      assert(res.body.deprecated === '[WARNING] Use 1.0.0 instead of 2.0.0, reason: mock reason');
      // don't change version
      assert(res.body.version === '2.0.0');

      // same version not fix bug version
      console.log('checking /foo/3.0.0');
      res = await app.httpRequest()
        .get('/foo/3.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-3.0.0.tgz');
      assert(!res.body.deprecated);
      assert(res.body.version === '3.0.0');

      // same version fix bug version due to scripts
      console.log('checking /foo/4.0.0');
      res = await app.httpRequest()
        .get('/foo/4.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');

      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-4.0.0.tgz');
      assert(res.body.deprecated === '[WARNING] Override scripts [postinstall], reason: evil scripts');
      assert(res.body.version === '4.0.0');
      assert(res.body.scripts.test === 'echo "test"');
      assert(res.body.scripts.postinstall === '');

      // sync worker request should not effect
      res = await app.httpRequest()
        .get(`/${pkgV1.name}/2.0.0?cache=0`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert(new URL(res.body.dist.tarball).pathname === '/foo/-/foo-2.0.0.tgz');
      assert(!res.body.deprecated);
      assert(res.body.version === '2.0.0');
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
      assert(res.headers['cache-control'] === 'max-age=0, s-maxage=120, must-revalidate');
      assert(res.headers.vary === 'Origin, Accept, Accept-Encoding');
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
        .get(`/${pkg.name}/beta-not-exists`)
        .expect(404);
      assert(!res.headers.etag);
      assert(res.body.error === `[NOT_FOUND] ${pkg.name}@beta-not-exists not found`);
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
      assert(res.body.error === `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);

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
      assert(res.body.error === '[NOT_FOUND] @cnpm/foonot-exists not found');
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
      assert(res.body.error === '[NOT_FOUND] foo-exists@1.0.40000404 not found');
    });

    it('should not redirect private scope package to source registry when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert(res.body.error === '[NOT_FOUND] @cnpm/foonot-exists not found');
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
  });
});
