import { Subscription } from 'egg';
import { TaskService } from '../core/service/TaskService';
import { TaskType } from '../common/enum/Task';
import { CreateHookTask } from '../core/entity/Task';
import { CreateHookTriggerService } from '../core/service/CreateHookTriggerService';

let executingCount = 0;
export default class CreateTriggerHookWorker extends Subscription {
  static get schedule() {
    return {
      interval: 1000,
      type: 'all',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (!app.config.cnpmcore.hookEnable) return;
    if (executingCount >= app.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks) return;

    await ctx.beginModuleScope(async () => {
      const createHookTriggerService = await ctx.getEggObject(CreateHookTriggerService);
      const taskService = await ctx.getEggObject(TaskService);
      executingCount++;
      try {
        let task = await taskService.findExecuteTask(TaskType.CreateHook) as CreateHookTask;
        while (task) {
          const startTime = Date.now();
          ctx.logger.info('[CreateTriggerHookWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
            executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
            startTime - task.updatedAt.getTime());
          await createHookTriggerService.executeTask(task);
          const use = Date.now() - startTime;
          ctx.logger.info('[CreateTriggerHookWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
            executingCount, task.taskId, task.targetName, use);
          if (executingCount >= app.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks) {
            ctx.logger.info('[CreateTriggerHookWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
              executingCount, app.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks);
            break;
          }
          // try next task
          task = await taskService.findExecuteTask(TaskType.CreateHook) as CreateHookTask;
        }
      } catch (err) {
        ctx.logger.error('[TriggerHookWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
      } finally {
        executingCount--;
      }
    });
  }
}
