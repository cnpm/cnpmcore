import { Subscription } from 'egg';
import { TaskService } from '../core/service/TaskService';
import { CacheAdapter } from '../common/adapter/CacheAdapter';

const cnpmcoreCore = 'cnpmcoreCore';

export default class TaskTimeoutHandler extends Subscription {
  static get schedule() {
    return {
      immediate: process.env.NODE_ENV !== 'test',
      interval: 60000,
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    await ctx.beginModuleScope(async () => {
      const taskService: TaskService = ctx.module[cnpmcoreCore].taskService;
      const cache: CacheAdapter = await app.getEggObject(CacheAdapter);

      await cache.usingLock('TaskTimeoutHandler', 60, async () => {
        const result = await taskService.retryExecuteTimeoutTasks();
        ctx.logger.info('[TaskTimeoutHandler:subscribe] retry execute timeout tasks: %j', result);
      });
    });
  }
}
