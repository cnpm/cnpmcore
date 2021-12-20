import { Subscription } from 'egg';
import { PackageSyncerService } from '../core/service/PackageSyncerService';

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
    if (app.config.cnpmcore.syncMode !== 'all') return;
    if (executingCount >= app.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) return;

    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      executingCount++;
      const span = ctx.tracer.startSpan('execute_task');
      try {
        let task = await packageSyncerService.findExecuteTask();
        while (task) {
          const startTime = Date.now();
          ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
            executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
            startTime - task.updatedAt.getTime());
          await packageSyncerService.executeTask(task);
          const use = Date.now() - startTime;
          ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
            executingCount, task.taskId, task.targetName, use);
          // try next task
          task = await packageSyncerService.findExecuteTask();
        }
      } catch (err) {
        ctx.logger.error('[SyncPackageWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
      } finally {
        executingCount--;
        span.finish();
      }
    });
  }
}
