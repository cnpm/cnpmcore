import { PackageSyncerService } from '../core/service/PackageSyncerService';
import { Subscription } from 'egg';

const cnpmcoreCore = 'cnpmcoreCore';

let executing = false;
export default class SyncPackageWorker extends Subscription {
  static get schedule() {
    return {
      interval: 1000,
      type: 'all',
    };
  }

  async subscribe() {
    if (executing) return;
    executing = true;
    const { ctx } = this;
    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      try {
        const task = await packageSyncerService.findExecuteTask();
        if (!task) {
          return;
        }
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask] taskId: %s, params: %j',
          task.taskId, task.data);
        await packageSyncerService.executeTask(task);
      } finally {
        executing = false;
      }
    });
  }
}
