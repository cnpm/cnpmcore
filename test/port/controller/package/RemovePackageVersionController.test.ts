import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { PackageRepository } from '../../../../app/repository/PackageRepository';

describe('test/port/controller/package/RemovePackageVersionController.test.ts', () => {
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

  describe('[DELETE /:fullname/-/:filenameWithVersion.tgz/-rev/:rev] remove()', () => {
    it('should remove the latest version', async () => {
      let pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
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
      const pkgVersion = res.body;
      const tarballUrl = new URL(pkgVersion.dist.tarball).pathname;
      res = await app.httpRequest()
        .get(`${tarballUrl}`);
      assert(res.status === 200 || res.status === 302);

      pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '2.0.0',
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      res = await app.httpRequest()
        .delete(`${tarballUrl}/-rev/${pkgVersion._rev}`)
        .set('authorization', publisher.authorization)
        .set('npm-command', 'unpublish')
        .set('user-agent', publisher.ua)
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`${tarballUrl}`);
      if (res.status === 404) {
        assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foo@1.0.0 not found');
      } else {
        // 302
        assert.equal(res.status, 302);
        const { status } = await app.curl(res.headers.location);
        assert.equal(status, 404);
      }

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert(!res.body.versions['1.0.0']);
      assert(res.body.versions['2.0.0']);
      assert.equal(res.body['dist-tags'].latest, '2.0.0');

      // remove all versions
      res = await app.httpRequest()
        .delete(`${tarballUrl.replace('1.0.0', '2.0.0')}/-rev/${pkgVersion._rev}`)
        .set('authorization', publisher.authorization)
        .set('npm-command', 'unpublish')
        .set('user-agent', publisher.ua)
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert(!res.body.versions);
      assert.equal(res.body.name, pkg.name);
      assert(res.body.time.unpublished);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
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
      const pkgVersion = res.body;
      const tarballUrl = new URL(pkgVersion.dist.tarball).pathname.replace('1.0.0', '2.0.0');

      res = await app.httpRequest()
        .delete(`${tarballUrl}/-rev/${pkg._rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'unpublish')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foo@2.0.0 not found');
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .delete('/@cnpm/foo/-/foo-4.0.0.tgz/-rev/1-61af62d6295fcbd9f8f1c08f')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'unpublish')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foo not found');
    });

    it('should 400 when npm-command header invalid', async () => {
      const res = await app.httpRequest()
        .delete('/@cnpm/foo/-/foo-4.0.0.tgz/-rev/1-61af62d6295fcbd9f8f1c08f')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(400);
      assert.equal(res.body.error, '[BAD_REQUEST] Only allow "unpublish" npm-command');
    });

    it('should 403 when published over 72 hours', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
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
      const pkgVersion = res.body;
      const tarballUrl = new URL(pkgVersion.dist.tarball).pathname;

      const pkgEntity = await packageRepository.findPackage('@cnpm', 'foo');
      assert(pkgEntity);
      const pkgVersionEntity = await packageRepository.findPackageVersion(pkgEntity.packageId, '1.0.0');
      assert(pkgVersionEntity);
      pkgVersionEntity.publishTime = new Date(Date.now() - 72 * 3600000 - 100);
      await packageRepository.savePackageVersion(pkgVersionEntity!);

      res = await app.httpRequest()
        .delete(`${tarballUrl}/-rev/${pkg._rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'unpublish')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] @cnpm/foo@1.0.0 unpublish is not allowed after 72 hours of released');
    });
  });
});
