import { PackageSyncerService } from '../core/service/PackageSyncerService';
import { Subscription } from 'egg';

const cnpmcoreCore = 'cnpmcoreCore';

let executingCount = 0;
export default class SyncPackageWorker extends Subscription {
  static get schedule() {
    return {
      interval: 1000,
      type: 'all',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (executingCount >= app.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) return;

    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      executingCount++;
      try {
        const task = await packageSyncerService.findExecuteTask();
        if (!task) {
          return;
        }
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          Date.now() - task.updatedAt.getTime());
        await packageSyncerService.executeTask(task);
      } finally {
        executingCount--;
      }
    });
  }
}
