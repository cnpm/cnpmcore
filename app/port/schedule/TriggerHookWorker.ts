import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { HookTriggerService } from '../../core/service/HookTriggerService';
import { TaskService } from '../../core/service/TaskService';
import { TaskType } from '../../common/enum/Task';
import { TriggerHookTask } from '../../core/entity/Task';

let executingCount = 0;
@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 1000,
  },
})
export class TriggerHookWorker {
  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly hookTriggerService: HookTriggerService;

  @Inject()
  private readonly taskService: TaskService;

  async subscribe() {
    if (executingCount >= this.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks) return;

    executingCount++;
    try {
      let task = await this.taskService.findExecuteTask(TaskType.TriggerHook) as TriggerHookTask;
      while (task) {
        const startTime = Date.now();
        this.logger.info('[TriggerHookWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        await this.hookTriggerService.executeTask(task);
        const use = Date.now() - startTime;
        this.logger.info('[TriggerHookWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount, task.taskId, task.targetName, use);
        if (executingCount >= this.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks) {
          this.logger.info('[TriggerHookWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
            executingCount, this.config.cnpmcore.triggerHookWorkerMaxConcurrentTasks);
          break;
        }
        // try next task
        task = await this.taskService.findExecuteTask(TaskType.TriggerHook) as TriggerHookTask;
      }
    } catch (err) {
      this.logger.error('[TriggerHookWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
    } finally {
      executingCount--;
    }
  }
}
