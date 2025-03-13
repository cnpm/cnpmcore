import type { EggAppConfig, EggLogger } from 'egg';
import type { IntervalParams } from '@eggjs/tegg/schedule';
import { Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';

import type { BinarySyncerService } from '../../core/service/BinarySyncerService.js';
import { isTimeoutError } from '../../common/ErrorUtil.js';

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 10000,
  },
})
export class SyncBinaryWorker {
  @Inject()
  private readonly binarySyncerService: BinarySyncerService;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    if (!this.config.cnpmcore.enableSyncBinary) return;

    const task = await this.binarySyncerService.findExecuteTask();
    if (!task) return;

    const startTime = Date.now();
    this.logger.info(
      '[SyncBinaryWorker:executeTask:start] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
      task.taskId,
      task.targetName,
      task.attempts,
      task.data,
      task.updatedAt,
      startTime - task.updatedAt.getTime()
    );
    try {
      await this.binarySyncerService.executeTask(task);
    } catch (err) {
      const use = Date.now() - startTime;
      this.logger.warn(
        '[SyncBinaryWorker:executeTask:error] taskId: %s, targetName: %s, use %sms, error: %s',
        task.taskId,
        task.targetName,
        use,
        err.message
      );
      if (isTimeoutError(err)) {
        this.logger.warn(err);
      } else {
        this.logger.error(err);
      }
      return;
    }
    const use = Date.now() - startTime;
    this.logger.info(
      '[SyncBinaryWorker:executeTask:success] taskId: %s, targetName: %s, use %sms',
      task.taskId,
      task.targetName,
      use
    );
  }
}
