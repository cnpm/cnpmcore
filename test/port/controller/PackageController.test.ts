import assert from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService';
import { Package } from '../../../app/repository/model/Package';
import { PackageVersion } from '../../../app/repository/model/PackageVersion';
import { Dist } from '../../../app/repository/model/Dist';

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

  describe('/:name/:test', () => {
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
});
