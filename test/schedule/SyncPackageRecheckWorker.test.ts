import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackageSyncRecheckService } from '../../app/core/service/PackageSyncRecheckService.ts';

describe('test/schedule/SyncPackageRecheckWorker.test.ts', () => {
  it('runs delayed checks only when changes synchronization is active', async () => {
    let dispatches = 0;
    mock(PackageSyncRecheckService.prototype, 'dispatch', async () => {
      dispatches++;
    });
    const dispatch = fileURLToPath(new URL('../../app/port/schedule/SyncPackageRecheckWorker.ts', import.meta.url));
    async function run() {
      await app.runSchedule(dispatch);
    }
    mock(app.config.cnpmcore, 'syncMode', 'none');
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await run();
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'enableChangesStream', false);
    await run();
    assert.equal(dispatches, 0);
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await run();
    assert.equal(dispatches, 1);
  });
});
