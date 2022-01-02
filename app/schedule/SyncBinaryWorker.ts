import { Subscription } from 'egg';
import { BinarySyncerService } from '../core/service/BinarySyncerService';

const cnpmcoreCore = 'cnpmcoreCore';

export default class SyncBinaryWorker extends Subscription {
  static get schedule() {
    return {
      interval: 10000,
      type: 'all',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (!app.config.cnpmcore.enableSyncBinary) return;

    await ctx.beginModuleScope(async () => {
      const binarySyncerService: BinarySyncerService = ctx.module[cnpmcoreCore].binarySyncerService;
      const span = ctx.tracer.startSpan('execute_binary_task');
      try {
        const task = await binarySyncerService.findExecuteTask();
        if (!task) return;

        const startTime = Date.now();
        ctx.logger.info('[SyncBinaryWorker:executeTask:start] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        await binarySyncerService.executeTask(task);
        const use = Date.now() - startTime;
        ctx.logger.info('[SyncBinaryWorker:executeTask:success] taskId: %s, targetName: %s, use %sms',
          task.taskId, task.targetName, use);
      } finally {
        span.finish();
      }
    });
  }
}
