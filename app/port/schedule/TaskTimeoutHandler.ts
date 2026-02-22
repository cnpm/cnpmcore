import { Inject, Logger } from 'egg';
import { Schedule, ScheduleType, type IntervalParams } from 'egg/schedule';

import type { CacheAdapter } from '../../common/adapter/CacheAdapter.ts';
import type { TaskService } from '../../core/service/TaskService.ts';

@Schedule<IntervalParams>(
  {
    type: ScheduleType.WORKER,
    scheduleData: {
      interval: 60_000,
    },
  },
  {
    immediate: process.env.NODE_ENV !== 'test',
  },
)
export class TaskTimeoutHandler {
  @Inject()
  private readonly taskService: TaskService;

  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  @Inject()
  private readonly logger: Logger;

  async subscribe() {
    await this.cacheAdapter.usingLock('TaskTimeoutHandler', 60, async () => {
      const result = await this.taskService.retryExecuteTimeoutTasks();
      this.logger.info('[TaskTimeoutHandler:subscribe] retry execute timeout tasks: %j', result);
    });
  }
}
