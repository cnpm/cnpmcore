import { Subscription } from 'egg';
import { PackageSyncerService } from '../core/service/PackageSyncerService';
import { Task } from '../core/entity/Task';

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
      let task: Task | null = null;
      try {
        task = await packageSyncerService.findExecuteTask();
        if (!task) {
          return;
        }
        const startTime = Date.now();
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        await packageSyncerService.executeTask(task);
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount, task.taskId, task.targetName, Date.now() - startTime);
      } catch (err) {
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:error][%s] taskId: %s, targetName: %s, %s',
          executingCount, task && task.taskId, task && task.targetName, err);
      } finally {
        executingCount--;
      }
    });
  }
}
