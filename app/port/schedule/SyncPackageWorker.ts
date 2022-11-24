import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { PackageSyncerService } from '../../core/service/PackageSyncerService';
import { CacheAdapter } from '../../../app/common/adapter/CacheAdapter';

let executingCount = 0;

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 1000,
  },
})
export class SyncPackageWorker {
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== 'all') return;
    if (executingCount >= this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) return;

    executingCount++;
    try {
      let task = await this.packageSyncerService.findExecuteTask();
      while (task) {
        const taskId = task.taskId;
        const startTime = Date.now();
        this.logger.info('[SyncPackageWorker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
          executingCount, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        // 默认独占 1 分钟
        // 防止同名任务导致互相冲突
        // 只需保证间隔顺序即可
        await this.cacheAdapter.waitForUnLock(`${task.type}_${task.targetName}`, 60, async () => {
          const refreshedTask = await this.packageSyncerService.findTask(taskId);
          if (refreshedTask) {
            await this.packageSyncerService.executeTask(refreshedTask);
          }
        });
        const use = Date.now() - startTime;
        this.logger.info('[SyncPackageWorker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms',
          executingCount, task.taskId, task.targetName, use);
        if (executingCount >= this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks) {
          this.logger.info('[SyncPackageWorker:subscribe:executeTask] current sync task count %s, exceed max concurrent tasks %s',
            executingCount, this.config.cnpmcore.syncPackageWorkerMaxConcurrentTasks);
          break;
        }
        // try next task
        task = await this.packageSyncerService.findExecuteTask();
      }
    } catch (err) {
      this.logger.error('[SyncPackageWorker:subscribe:executeTask:error][%s] %s', executingCount, err);
    } finally {
      executingCount--;
    }
  }
}
