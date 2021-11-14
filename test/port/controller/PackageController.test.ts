import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService';
import { Package } from '../../../app/repository/model/Package';
import { PackageVersion } from '../../../app/repository/model/PackageVersion';
import { PackageTag } from '../../../app/repository/model/PackageTag';
import { Dist } from '../../../app/repository/model/Dist';
import { TestUtil } from 'test/TestUtil';
import { NFSClientAdapter } from '../../../app/common/adapter/NFSClientAdapter';

describe('test/controller/PackageController.test.ts', () => {
  let ctx: Context;
  let packageManagerService: PackageManagerService;
  let nfsClientAdapter: NFSClientAdapter;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageManagerService = await ctx.getEggObject(PackageManagerService);
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    mock.restore();
    await Promise.all([
      Package.truncate(),
      PackageTag.truncate(),
      PackageVersion.truncate(),
      Dist.truncate(),
    ]);
  });

  describe('showVersion()', () => {
    it('should show one package version', async () => {
      await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(100),
        },
        tag: '',
        name: 'foo',
        description: 'foo description',
        // https://mathiasbynens.be/notes/mysql-utf8mb4
        packageJson: { name: 'foo', test: 'test', description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻' },
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      });
      const res = await app.httpRequest()
        .get('/foo/1.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.name, 'foo');
      assert.equal(res.body.test, 'test');
      assert.match(res.body.dist.tarball, /^http:\/\//);
      assert(res.body.dist.tarball.endsWith('/foo/-/foo-1.0.0.tgz'));
      assert.equal(res.body.dist.shasum, 'ed4a77d1b56a118938788fc53037759b6c501e3d');
      assert.equal(res.body.dist.integrity, 'sha512-8gb08O8JuQg38dFaB8bPS9KR2BdmP5+FoPxDQewZkQcZrVcbYQKjZq6EjNDxh9Da75EuBYmLgsNSE81JpF7o4A==');
      assert.equal(res.body.dist.size, 100);
      assert.equal(res.body.description, 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻');
    });

    it('should work with scoped package', async () => {
      await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tag: '',
        description: 'foo description',
        scope: '@cnpm',
        name: '@cnpm/foo',
        readme: '',
        packageJson: {},
        version: '1.0.0',
        isPrivate: true,
      });

      await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .expect(200)
        .expect(res => {
          assert(res.body);
        });
    });
  });

  describe('downloadVersionTar()', () => {
    const name = '@cnpm/testmodule-download-version-tar';
    beforeEach(async () => {
      const pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
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
        .expect('location', 'https://cdn.mock.com/packages/@cnpm/@cnpm/testmodule-download-version-tar/1.0.0/@cnpm/testmodule-download-version-tar-1.0.0.tgz')
        .expect(302);
    });

    it('should download a version tar with streaming success', async () => {
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar-1.0.0.tgz"')
        .expect(200);
    });

    it('should download non-scope package tar success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'testmodule-download-version-tar222', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
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
  });

  describe('addVersion()', () => {
    it('should add new version success', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      console.log(res.body);

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .send(pkg2)
        .expect(201);
      assert(res.body.ok === true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should add same version throw error', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '99.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
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
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] version("1.0.woring-version") format invalid');
    });

    it('should 422 when attachment data format invalid', async () => {
      let pkg = await TestUtil.getFullPackage({
        attachment: {
          data: null,
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
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
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.shasum invalid');
    });

    it('should 422 when name not match pkg.name', async () => {
      const pkg = await TestUtil.getFullPackage();
      const res = await app.httpRequest()
        .put('/foo')
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] name(foo) not match package.name(@cnpm/testmodule)');
    });

    it('should 422 _attachments is empty', async () => {
      let res = await app.httpRequest()
        .put('/foo')
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
        .send({
          name: 'foo',
          versions: {},
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] versions is empty');

      res = await app.httpRequest()
        .put('/foo')
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
});
