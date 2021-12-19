import { Subscription } from 'egg';
import { ChangesStreamService } from '../core/service/ChangesStreamService';

const cnpmcoreCore = 'cnpmcoreCore';

export default class ChangesStreamWorker extends Subscription {
  static get schedule() {
    return {
      interval: 60000,
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (app.config.cnpmcore.syncMode !== 'all' || !app.config.cnpmcore.enableChangesStream) return;

    await ctx.beginModuleScope(async () => {
      const changesStreamService: ChangesStreamService = ctx.module[cnpmcoreCore].changesStreamService;
      const task = await changesStreamService.findExecuteTask();
      if (!task) return;
      ctx.logger.warn('[ChangesStreamWorker:start] taskId: %s', task.taskId);
      await changesStreamService.executeTask(task);
    });
  }
}
