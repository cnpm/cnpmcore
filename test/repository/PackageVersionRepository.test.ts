import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { PackageVersionRepository } from '../../app/repository/PackageVersionRepository.ts';
import { TestUtil } from '../TestUtil.ts';

describe('test/repository/PackageVersionRepository.test.ts', () => {
  let packageVersionRepository: PackageVersionRepository;

  describe('findAllVersions', () => {
    beforeEach(async () => {
      packageVersionRepository = await app.getEggObject(PackageVersionRepository);
    });

    it('should return empty array when package not found', async () => {
      const versions = await packageVersionRepository.findAllVersions('', 'not-exist');
      assert.deepEqual(versions, []);
    });

    it('should return all versions when package found', async () => {
      const { user } = await TestUtil.createPackage({ name: '@cnpm/test-package', version: '1.0.1' });
      await TestUtil.createPackage({ name: '@cnpm/test-package', version: '1.1.0' }, user);

      const versions = await packageVersionRepository.findAllVersions('@cnpm', 'test-package');
      assert.deepEqual(versions, ['1.0.1', '1.1.0']);
    });
  });
});
