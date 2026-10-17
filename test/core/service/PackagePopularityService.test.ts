import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackagePopularityService } from '../../../app/core/service/PackagePopularityService.ts';
import { PackageVersionDownloadRepository } from '../../../app/repository/PackageVersionDownloadRepository.ts';

describe('test/core/service/PackagePopularityService.test.ts', () => {
  let service: PackagePopularityService;
  beforeEach(async () => {
    service = await app.getEggObject(PackagePopularityService);
    mock(app.config.cnpmcore, 'syncRecheck', {
      ...app.config.cnpmcore.syncRecheck,
      enabled: true,
      maxPackages: 2,
      include: ['pinned'],
    });
    mock.data(PackageVersionDownloadRepository.prototype, 'listPopularPackages', [
      { name: 'cold', downloads: 9999 },
      { name: 'boundary', downloads: 10_000 },
      { name: 'hot', downloads: 20_000 },
    ]);
  });

  it('applies the threshold and capacity including pinned packages, and caches the selection', async () => {
    await service.refresh();
    assert.equal(await service.includes('pinned'), true);
    assert.equal(await service.includes('hot'), true);
    assert.equal(await service.includes('cold'), false);
    assert.equal(await service.includes('boundary'), false);
    mock.error(PackageVersionDownloadRepository.prototype, 'listPopularPackages');
    await service.refresh();
    assert.equal(await service.includes('hot'), true);
  });

  it('includes the threshold boundary and excludes invalid counts from a shared snapshot', async () => {
    mock(app.config.cnpmcore.syncRecheck, 'popularityUrl', 'https://stats.example.com/packages');
    mock(app.config.cnpmcore.syncRecheck, 'include', []);
    app.mockHttpclient('https://stats.example.com/packages', {
      data: {
        updatedAt: new Date().toISOString(),
        packages: [
          { name: 'boundary', downloads: 10_000 },
          { name: 'cold', downloads: 9999 },
          { name: 'invalid', downloads: '999999' },
        ],
      },
    });
    mock.error(PackageVersionDownloadRepository.prototype, 'listPopularPackages');
    await service.refresh();
    assert.equal(await service.includes('boundary'), true);
    assert.equal(await service.includes('cold'), false);
    assert.equal(await service.includes('invalid'), false);
  });

  it('retains the last set when refresh fails and does no work when disabled', async () => {
    await service.refresh();
    await app.redis.del('CNPMCORE_SYNC_RECHECK:popular:updated');
    mock(app.config.cnpmcore.syncRecheck, 'popularityUrl', 'https://stats.example.com/stale');
    app.mockHttpclient('https://stats.example.com/stale', {
      data: { updatedAt: '2000-01-01', packages: [] },
    });
    await assert.rejects(service.refresh(), /stale/);
    assert.equal(await service.includes('hot'), true);
    mock(app.config.cnpmcore.syncRecheck, 'enabled', false);
    await service.refresh();
    assert.equal(await service.includes('hot'), false);
  });

  it('rejects invalid limits before starting background work', async () => {
    mock(app.config.cnpmcore.syncRecheck, 'delays', [100, 50]);
    await assert.rejects(service.refresh(), /strictly increasing/);
    mock(app.config.cnpmcore.syncRecheck, 'maxAttemptsPerHour', 0);
    await assert.rejects(service.refresh(), /positive integers/);
  });

  it('rebuilds an evicted selection even when its refresh timestamp remains', async () => {
    await service.refresh();
    await app.redis.del('CNPMCORE_SYNC_RECHECK:popular');
    await service.refresh();
    assert.equal(await service.includes('hot'), true);
  });

  it('does not publish a slow refresh after another process takes its lease', async () => {
    await service.refresh();
    await app.redis.del('CNPMCORE_SYNC_RECHECK:popular:updated');
    mock(PackageVersionDownloadRepository.prototype, 'listPopularPackages', async () => {
      await app.redis.set('CNPMCORE_SYNC_RECHECK:popular:lock', 'new-owner');
      return [{ name: 'replacement', downloads: 30_000 }];
    });
    await service.refresh();
    assert.equal(await service.includes('hot'), true);
    assert.equal(await service.includes('replacement'), false);
    assert.equal(await app.redis.get('CNPMCORE_SYNC_RECHECK:popular:lock'), 'new-owner');
  });
});
