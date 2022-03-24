import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';

describe('test/schedule/CheckRecentlyUpdatedPackages.test.ts', () => {
  let ctx: Context;
  let packageSyncerService: PackageSyncerService;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should work', async () => {
    app.mockLog();
    // syncMode=none
    await app.runSchedule('CheckRecentlyUpdatedPackages');
    app.notExpectLog('[CheckRecentlyUpdatedPackages.subscribe]');

    // syncMode=all
    mock(app.config.cnpmcore, 'syncMode', 'all');
    await app.runSchedule('CheckRecentlyUpdatedPackages');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] request');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] parse');
    const task = await packageSyncerService.findExecuteTask();
    assert(task);
  });

  it('should handle pageUrl request error', async () => {
    mock(app.config.cnpmcore, 'syncMode', 'all');
    app.mockLog();
    app.mockHttpclient(/https:\/\/www.npmjs.com\/browse\/updated/, () => {
      throw new Error('mock http request error');
    });
    await app.runSchedule('CheckRecentlyUpdatedPackages');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe:error][0] request');
    const task = await packageSyncerService.findExecuteTask();
    assert(!task);
  });

  it('should handle PackageSyncerService.createTask error', async () => {
    mock(app.config.cnpmcore, 'syncMode', 'all');
    app.mockLog();
    mock.error(PackageSyncerService.prototype, 'createTask');
    await app.runSchedule('CheckRecentlyUpdatedPackages');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe:error][0] parse');
    const task = await packageSyncerService.findExecuteTask();
    assert(!task);
  });
});
