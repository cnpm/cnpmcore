import {
  Schedule,
  ScheduleType,
  type IntervalParams,
} from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import type { EggAppConfig, EggLogger } from 'egg';

import type { TaskService } from '../../core/service/TaskService.js';
import { TaskType } from '../../common/enum/Task.js';
import type { CreateHookTask } from '../../core/entity/Task.js';
import type { CreateHookTriggerService } from '../../core/service/CreateHookTriggerService.js';

let executingCount = 0;

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 1000,
  },
})
export class CreateTriggerHookWorker {
  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly createHookTriggerService: CreateHookTriggerService;

  @Inject()
  private readonly taskService: TaskService;

  async subscribe() {
    if (!this.config.cnpmcore.hookEnable) return;
    if (
      executingCount >=
      this.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks
    )
      return;

    executingCount++;
    try {
      let task = (await this.taskService.findExecuteTask(
        TaskType.CreateHook
      )) as CreateHookTask;
      while (task) {
        const startTime = Date.now();
        this.logger.info(
          '[CreateTriggerHookWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount,
          task.taskId,
          task.targetName,
          task.attempts,
          task.data,
          task.updatedAt,
          startTime - task.updatedAt.getTime()
        );
        await this.createHookTriggerService.executeTask(task);
        const use = Date.now() - startTime;
        this.logger.info(
          '[CreateTriggerHookWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount,
          task.taskId,
          task.targetName,
          use
        );
        if (
          executingCount >=
          this.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks
        ) {
          this.logger.info(
            '[CreateTriggerHookWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
            executingCount,
            this.config.cnpmcore.createTriggerHookWorkerMaxConcurrentTasks
          );
          break;
        }
        // try next task
        task = (await this.taskService.findExecuteTask(
          TaskType.CreateHook
        )) as CreateHookTask;
      }
    } catch (err) {
      this.logger.error(
        '[TriggerHookWorker:subscribe:executeTask:error][%s] %s',
        executingCount,
        err
      );
    } finally {
      executingCount--;
    }
  }
}
