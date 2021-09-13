import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService';
import { PackageRepository } from '../../../app/repository/PackageRepository';
import { Package } from '../../../app/repository/model/Package';
import { PackageVersion } from '../../../app/repository/model/PackageVersion';
import { Dist } from '../../../app/repository/model/Dist';

describe('test/core/service/PackageManagerService.test.ts', () => {
  let ctx: Context;
  let packageManagerService: PackageManagerService;
  let packageRepository: PackageRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageManagerService = await ctx.getEggObject(PackageManagerService);
    packageRepository = await ctx.getEggObject(PackageRepository);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    await Promise.all([
      Package.truncate(),
      PackageVersion.truncate(),
      Dist.truncate(),
    ]);
  });

  describe('create package', () => {
    it('should work', async () => {
      await packageManagerService.publish({
        dist: Buffer.alloc(0),
        distTag: '',
        name: 'foo',
        packageJson: {},
        version: '1.0.0',
      });
      const pkgVersion = await packageRepository.findPackageVersion(null, 'foo', '1.0.0');
      assert(pkgVersion);
      assert(pkgVersion.version === '1.0.0');
    });
  });
});
