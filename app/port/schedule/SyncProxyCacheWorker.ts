import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { ProxyCacheService } from '../../core/service/ProxyCacheService';
import { SyncMode } from '../../common/constants';


let executingCount = 0;

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 1000,
  },
})
export class SyncProxyCacheWorker {
  @Inject()
  private readonly proxyCacheService: ProxyCacheService;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) return;
    if (executingCount >= this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) return;

    executingCount++;
    try {
      let task = await this.proxyCacheService.findExecuteTask();
      while (task) {
        const startTime = Date.now();
        this.logger.info('[SyncProxyCacheWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        await this.proxyCacheService.executeTask(task);
        const use = Date.now() - startTime;
        this.logger.info('[SyncProxyCacheWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount, task.taskId, task.targetName, use);
        if (executingCount >= this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) {
          this.logger.info('[SyncProxyCacheWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
            executingCount, this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks);
          break;
        }
        // try next task
        task = await this.proxyCacheService.findExecuteTask();
      }
    } catch (err) {
      this.logger.error('[SyncPackageWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
    } finally {
      executingCount--;
    }
  }
}
