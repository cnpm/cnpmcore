import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackagePopularityService } from '../../../app/core/service/PackagePopularityService.ts';
import { PackageVersionDownload } from '../../../app/repository/model/PackageVersionDownload.ts';
import { PackageRepository } from '../../../app/repository/PackageRepository.ts';
import { PackageVersionDownloadRepository } from '../../../app/repository/PackageVersionDownloadRepository.ts';
import { TestUtil } from '../../TestUtil.ts';

describe('test/core/service/PackagePopularityService.test.ts', () => {
  let service: PackagePopularityService;
  beforeEach(async () => {
    service = await app.getEggObject(PackagePopularityService);
    mock(app.config.cnpmcore.syncRecheck, 'enabled', true);
  });

  it('checks the current database totals against 10,000 downloads without a warmup', async () => {
    const name = '@cnpm/popular';
    await TestUtil.createPackage({ name, isPrivate: false });
    const pkg = await (await app.getEggObject(PackageRepository)).findPackage('@cnpm', 'popular');
    assert.ok(pkg);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const field = `d${String(yesterday.getDate()).padStart(2, '0')}`;
    const counter = await PackageVersionDownload.create({
      packageId: pkg.packageId,
      version: '1.0.0',
      yearMonth: yesterday.getFullYear() * 100 + yesterday.getMonth() + 1,
      [field]: 9999,
    });
    assert.equal(await service.includes(name), false);
    await counter.update({ [field]: 10_000 });
    assert.equal(await service.includes(name), true);
    await counter.update({ [field]: 9999 });
    assert.equal(await service.includes(name), false);
  });

  it('excludes packages with no stored downloads', async () => {
    assert.equal(await service.includes('missing'), false);
    await TestUtil.createPackage({ name: '@cnpm/empty', isPrivate: false });
    assert.equal(await service.includes('@cnpm/empty'), false);
  });

  it('does not query download counts when disabled', async () => {
    mock(app.config.cnpmcore.syncRecheck, 'enabled', false);
    mock.error(PackageVersionDownloadRepository.prototype, 'getWeeklyDownloads');
    assert.equal(await service.includes('popular'), false);
  });

  it('rejects invalid limits before checking eligibility', async () => {
    mock(app.config.cnpmcore.syncRecheck, 'delays', [100, 50]);
    await assert.rejects(service.includes('popular'), /strictly increasing/);
    mock(app.config.cnpmcore.syncRecheck, 'maxAttemptsPerHour', 0);
    await assert.rejects(service.includes('popular'), /positive integers/);
  });
});
