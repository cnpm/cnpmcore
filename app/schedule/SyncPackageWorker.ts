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
    if (app.config.cnpmcore.syncMode !== 'all') return;
    if (executingCount >= app.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) return;

    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      executingCount++;
      let task: Task | null = null;
      const span = ctx.tracer.startSpan('execute_task');
      const startTime = Date.now();
      try {
        task = await packageSyncerService.findExecuteTask();
        if (!task) {
          return;
        }
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        await packageSyncerService.executeTask(task);
        const use = Date.now() - startTime;
        ctx.logger.info('[SyncPackageWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount, task.taskId, task.targetName, use);
        span.log({ event: 'task_success', task_id: task.taskId, target_name: task.targetName, use });
      } catch (err) {
        ctx.logger.error('[SyncPackageWorker:subscribe:executeTask:error][%s] taskId: %s, targetName: %s, %s',
          executingCount, task && task.taskId, task && task.targetName, err);
        const use = Date.now() - startTime;
        span.log({ event: 'task_error', task_id: task && task.taskId, target_name: task && task.targetName, use });
      } finally {
        executingCount--;
        span.finish();
      }
    });
  }
}
