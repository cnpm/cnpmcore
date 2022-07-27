import { Subscription } from 'egg';
import { PackageSyncerService } from '../core/service/PackageSyncerService';

const cnpmcoreCore = 'cnpmcoreCore';

export default class SyncExistPackageWorker extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 1 ? * 0', // run every Sun. at 01:00:00
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (app.config.cnpmcore.syncMode !== 'exist') return;

    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      const startTime = Date.now();
      ctx.logger.info('[SyncExistPackageWorker:subscribe:start] startAt %s', startTime);

      const tasks = await packageSyncerService.syncExistPackage();
      ctx.logger.info('[SyncExistPackageWorker:subscribe:success] createTask success. count: %d, use %d ms', tasks.length, Date.now() - startTime);
    });
  }
}
