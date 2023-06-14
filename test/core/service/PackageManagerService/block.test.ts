import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';

describe('test/core/service/PackageManagerService/block.test.ts', () => {
  let packageManagerService: PackageManagerService;

  beforeEach(async () => {
    packageManagerService = await app.getEggObject(PackageManagerService);
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  describe('block()', () => {
    it('should work with name', async () => {
      app.mockLog();
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      const blockRes = await packageManagerService.blockPackageByFullname(pkg.name, 'xxx');
      assert(blockRes.packageVersionBlockId);

      assert.doesNotReject(packageManagerService.unblockPackageByFullname(pkg.name || ''));
    });
  });
});
