import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService';
import { Package } from '../../../app/repository/model/Package';
import { PackageVersion } from '../../../app/repository/model/PackageVersion';
import { Dist } from '../../../app/repository/model/Dist';
import { TestUtil } from 'test/TestUtil';

describe('test/controller/PackageController.test.ts', () => {
  let ctx: Context;
  let packageManagerService: PackageManagerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageManagerService = await ctx.getEggObject(PackageManagerService);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    await Promise.all([
      Package.truncate(),
      PackageVersion.truncate(),
      Dist.truncate(),
    ]);
  });

  describe('showVersion()', () => {
    beforeEach(async () => {
      await packageManagerService.publish({
        dist: Buffer.alloc(0),
        distTag: '',
        name: 'foo',
        packageJson: {},
        version: '1.0.0',
      });
    });

    it('should work', async () => {
      await app.httpRequest()
        .get('/foo/1.0.0')
        .expect(200)
        .expect(res => {
          assert(res.body);
        });
    });
  });

  describe('addVersion()', () => {
    it('should add new version success', async () => {
      const pkg = await TestUtil.getFullPackage();
      const res = await app.httpRequest()
        .put('/foo')
        .send(pkg)
        .expect(201);
      assert(res.body.ok === true);
      assert(/^\d+$/.test(res.body.rev));
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
      assert(res.body.error === '[invalid_param] _attachments is empty');

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
      assert(res.body.error === '[invalid_param] _attachments is empty');

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
      assert(res.body.error === '[invalid_param] _attachments is empty');
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
      assert(res.body.error === '[invalid_param] versions is empty');

      res = await app.httpRequest()
        .put('/foo')
        .send({
          name: 'foo',
          versions: [],
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[invalid_param] versions is empty');
    });

    it('should 422 dist-tags is empty', async () => {
      let res = await app.httpRequest()
        .put('/foo')
        .send({
          name: 'foo',
          versions: {
            name: 'foo',
            version: '1.0.0',
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert(res.body.error === '[invalid_param] dist-tags is empty');

      res = await app.httpRequest()
        .put('/foo')
        .send({
          name: 'foo',
          'dist-tags': {},
          versions: {
            name: 'foo',
            version: '1.0.0',
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert(res.body.error === '[invalid_param] dist-tags is empty');
    });
  });
});
