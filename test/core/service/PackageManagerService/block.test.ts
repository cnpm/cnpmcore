import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackageManagerService } from '../../../../app/core/service/PackageManagerService.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

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
      assert.ok(blockRes.packageVersionBlockId);

      assert.doesNotReject(packageManagerService.unblockPackageByFullname(pkg.name || ''));
    });
  });
});
