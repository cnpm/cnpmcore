import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TotalRepository } from '../../app/repository/TotalRepository.ts';

describe('test/repository/TotalRepository.test.ts', () => {
  let totalRepository: TotalRepository;

  beforeEach(async () => {
    totalRepository = await app.getEggObject(TotalRepository);
  });

  describe('TotalRepository', () => {
    it('should get initial package count', async () => {
      const count = await totalRepository.getPackageCount();
      assert.equal(count, 0);
    });

    it('should get initial package version count', async () => {
      const count = await totalRepository.getPackageVersionCount();
      assert.equal(count, 0);
    });

    it('should increment package count', async () => {
      await totalRepository.incrementPackageCount();
      const count = await totalRepository.getPackageCount();
      assert.equal(count, 1);
    });

    it('should increment package version count', async () => {
      await totalRepository.incrementPackageVersionCount();
      const count = await totalRepository.getPackageVersionCount();
      assert.equal(count, 1);
    });

    it('should increment multiple times', async () => {
      await totalRepository.incrementPackageCount();
      await totalRepository.incrementPackageCount();
      await totalRepository.incrementPackageVersionCount();
      await totalRepository.incrementPackageVersionCount();
      await totalRepository.incrementPackageVersionCount();

      const packageCount = await totalRepository.getPackageCount();
      const versionCount = await totalRepository.getPackageVersionCount();

      assert.equal(packageCount, 2);
      assert.equal(versionCount, 3);
    });
  });
});
