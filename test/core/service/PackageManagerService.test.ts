import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService';
import { PackageRepository } from '../../../app/repository/PackageRepository';
import { Package } from '../../../app/repository/model/Package';
import { PackageVersion } from '../../../app/repository/model/PackageVersion';
import { Dist } from '../../../app/repository/model/Dist';
import { TestUtil } from '../../TestUtil';

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

  describe('publish()', () => {
    it('should work with dist.content', async () => {
      const { packageId } = await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tag: '',
        scope: '',
        name: 'foo',
        description: 'foo description',
        packageJson: {},
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      });
      let pkgVersion = await packageRepository.findPackageVersion(packageId, '1.0.0');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.0.0');
      // another version
      await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tag: '',
        scope: '',
        name: 'foo',
        description: 'foo description new',
        packageJson: { name: 'foo', test: 'test', version: '1.0.0' },
        readme: '',
        version: '1.0.1',
        isPrivate: true,
      });
      pkgVersion = await packageRepository.findPackageVersion(packageId, '1.0.1');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.0.1');
    });

    it('should work with dist.localFile', async () => {
      const { packageId } = await packageManagerService.publish({
        dist: {
          localFile: TestUtil.getFixtures('pedding-1.1.0.tgz'),
        },
        tag: '',
        scope: '',
        name: 'pedding',
        description: 'pedding description',
        packageJson: { name: 'pedding', test: 'test', version: '1.1.0' },
        readme: '',
        version: '1.1.0',
        isPrivate: false,
      });
      const pkgVersion = await packageRepository.findPackageVersion(packageId, '1.1.0');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.1.0');
      assert.equal(pkgVersion.tarDist.size, 2672);
    });
  });
});
