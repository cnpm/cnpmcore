import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { getScopeAndName } from '../../../../app/common/PackageUtil';

describe('test/core/service/PackageManagerService/block.test.ts', () => {
  let packageManagerService: PackageManagerService;
  let packageRepository: PackageRepository;

  beforeEach(async () => {
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageRepository = await app.getEggObject(PackageRepository);
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  describe('block()', () => {
    it('should work with packageId', async () => {
      app.mockLog();
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      const [scope, name] = getScopeAndName(pkg.name);
      const model = await packageRepository.findPackage(scope, name);
      const blockRes = await packageManagerService.blockPackageByPackageId(model?.packageId || '', 'xxx');
      assert(blockRes.packageVersionBlockId);

      assert.doesNotReject(packageManagerService.unblockPackageByPackageId(model?.packageId || ''));
    });

    it('should work with name', async () => {
      app.mockLog();
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      const blockRes = await packageManagerService.blockPackageByName(pkg.name, 'xxx');
      assert(blockRes.packageVersionBlockId);

      assert.doesNotReject(packageManagerService.unblockPackageByName(pkg.name || ''));
    });
  });
});
