import { Subscription } from 'egg';
import { HookTriggerService } from '../core/service/HookTriggerService';
import { TaskService } from '../core/service/TaskService';
import { TaskType } from '../common/enum/Task';
import { TriggerHookTask } from '../core/entity/Task';

let executingCount = 0;
export default class TriggerHookWorker extends Subscription {
  static get schedule() {
    return {
      interval: 1000,
      type: 'all',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (executingCount >= app.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks) return;

    await ctx.beginModuleScope(async () => {
      const hookTriggerService = await ctx.getEggObject(HookTriggerService);
      const taskService = await ctx.getEggObject(TaskService);
      executingCount++;
      try {
        let task = await taskService.findExecuteTask(TaskType.TriggerHook) as TriggerHookTask;
        while (task) {
          const startTime = Date.now();
          ctx.logger.info('[TriggerHookWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
            executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
            startTime - task.updatedAt.getTime());
          await hookTriggerService.executeTask(task);
          const use = Date.now() - startTime;
          ctx.logger.info('[TriggerHookWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
            executingCount, task.taskId, task.targetName, use);
          if (executingCount >= app.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks) {
            ctx.logger.info('[TriggerHookWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
              executingCount, app.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks);
            break;
          }
          // try next task
          task = await taskService.findExecuteTask(TaskType.TriggerHook) as TriggerHookTask;
        }
      } catch (err) {
        ctx.logger.error('[TriggerHookWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
      } finally {
        executingCount--;
      }
    });
  }
}
