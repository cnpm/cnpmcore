import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackagePopularityService } from '../../app/core/service/PackagePopularityService.ts';
import { PackageSyncRecheckService } from '../../app/core/service/PackageSyncRecheckService.ts';

describe('test/schedule/SyncPackageRecheckWorker.test.ts', () => {
  it('runs both background jobs only when changes synchronization is active', async () => {
    let refreshes = 0;
    let dispatches = 0;
    mock(PackagePopularityService.prototype, 'refresh', async () => {
      refreshes++;
    });
    mock(PackageSyncRecheckService.prototype, 'dispatch', async () => {
      dispatches++;
    });
    const refresh = fileURLToPath(new URL('../../app/port/schedule/RefreshPackagePopularity.ts', import.meta.url));
    const dispatch = fileURLToPath(new URL('../../app/port/schedule/SyncPackageRecheckWorker.ts', import.meta.url));
    async function run() {
      await app.runSchedule(refresh);
      await app.runSchedule(dispatch);
    }
    mock(app.config.cnpmcore, 'syncMode', 'none');
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await run();
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'enableChangesStream', false);
    await run();
    assert.equal(refreshes, 0);
    assert.equal(dispatches, 0);
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await run();
    assert.equal(refreshes, 1);
    assert.equal(dispatches, 1);
  });
});
