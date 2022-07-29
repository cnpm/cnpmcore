import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { TestUtil } from 'test/TestUtil';

describe('test/schedule/SyncExistPackageWorker.test.ts', () => {
  let ctx: Context;
  let packageSyncerService: PackageSyncerService;

  beforeEach(async () => {
    mock(app.config.cnpmcore, 'syncMode', 'exist');
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
  });
  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should work', async () => {
    app.mockLog();

    // syncMode=all
    mock(app.config.cnpmcore, 'syncMode', 'all');
    await app.runSchedule('SyncExistPackageWorker');
    app.notExpectLog('[SyncExistPackageWorker:subscribe:start]');

    // syncMode=exist
    mock(app.config.cnpmcore, 'syncMode', 'exist');
    await app.runSchedule('SyncExistPackageWorker');
    app.expectLog('[SyncExistPackageWorker:subscribe:start]');
  });

  it('should sync existing packages automatically', async () => {
    const name = 'mk2test-module-cnpmsync-automatically';
    await TestUtil.createPackage({ name, version: '1.0.0', isPrivate: false });
    await TestUtil.createPackage({ name: `${name}-private`, version: '1.0.0', isPrivate: true });

    app.mockLog();
    await app.runSchedule('SyncExistPackageWorker');
    app.expectLog('[SyncExistPackageWorker:subscribe:start]');
    app.expectLog('[SyncExistPackageWorker:subscribe:success] createTask success. count: 1');

    let task = await packageSyncerService.findExecuteTask();
    assert(task);
    assert(task.targetName === name);

    // Don't sync private packages
    task = await packageSyncerService.findExecuteTask();
    assert(!task);
  });
});
