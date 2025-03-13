import type { EggAppConfig, EggLogger } from 'egg';
import type { IntervalParams } from '@eggjs/tegg/schedule';
import { Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';

import type { ChangesStreamService } from '../../core/service/ChangesStreamService.js';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60000,
  },
})
export class ChangesStreamWorker {
  @Inject()
  private readonly changesStreamService: ChangesStreamService;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    if (
      this.config.cnpmcore.syncMode === 'none' ||
      !this.config.cnpmcore.enableChangesStream
    )
      return;
    const task = await this.changesStreamService.findExecuteTask();
    if (!task) return;
    this.logger.info('[ChangesStreamWorker:start] taskId: %s', task.taskId);
    await this.changesStreamService.executeTask(task);
  }
}
