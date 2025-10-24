import {
  Schedule,
  ScheduleType,
  type IntervalParams,
} from 'egg/schedule';
import { Inject, Config, Logger } from 'egg';

import type { ChangesStreamService } from '../../core/service/ChangesStreamService.ts';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60_000,
  },
})
export class ChangesStreamWorker {
  @Inject()
  private readonly changesStreamService: ChangesStreamService;

  @Inject()
  private readonly config: Config;

  @Inject()
  private readonly logger: Logger;

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
