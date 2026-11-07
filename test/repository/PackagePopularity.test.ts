import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { PackageVersionDownload } from '../../app/repository/model/PackageVersionDownload.ts';
import { PackageRepository } from '../../app/repository/PackageRepository.ts';
import { PackageVersionDownloadRepository } from '../../app/repository/PackageVersionDownloadRepository.ts';
import { TestUtil } from '../TestUtil.ts';

describe('test/repository/PackagePopularity.test.ts', () => {
  it('aggregates seven complete days across a year boundary without imported totals or private packages', async () => {
    const repository = await app.getEggObject(PackageVersionDownloadRepository);
    const packages = await app.getEggObject(PackageRepository);
    for (const name of ['hot', 'cold', 'private']) {
      await TestUtil.createPackage({ name: `@cnpm/${name}`, isPrivate: name === 'private' });
      const pkg = await packages.findPackage('@cnpm', name);
      assert.ok(pkg);
      await PackageVersionDownload.create({
        packageId: pkg.packageId,
        version: '1.0.0',
        yearMonth: 202512,
        d26: 900_000,
        d27: 1000,
        d31: 2000,
      });
      await PackageVersionDownload.create({
        packageId: pkg.packageId,
        version: '2.0.0',
        yearMonth: 202601,
        d01: 3000,
        d02: name === 'cold' ? 3999 : 4000,
        d03: 900_000,
      });
      await PackageVersionDownload.create({ packageId: pkg.packageId, version: '*', yearMonth: 202601, d01: 900_000 });
    }
    const now = new Date(2026, 0, 3);
    assert.equal(await repository.getWeeklyDownloads('@cnpm/hot', now), 10_000);
    assert.equal(await repository.getWeeklyDownloads('@cnpm/cold', now), 9999);
    assert.equal(await repository.getWeeklyDownloads('@cnpm/private', now), 0);
    assert.equal(await repository.getWeeklyDownloads('hot', now), 0);
    assert.equal(await repository.getWeeklyDownloads('missing', now), 0);
  });
});
