import { EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { TaskService } from '../../core/service/TaskService';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60000,
  },
}, {
  immediate: process.env.NODE_ENV !== 'test',
})
export class TaskTimeoutHandler {
  @Inject()
  private readonly taskService: TaskService;

  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    await this.cacheAdapter.usingLock('TaskTimeoutHandler', 60, async () => {
      const result = await this.taskService.retryExecuteTimeoutTasks();
      this.logger.info('[TaskTimeoutHandler:subscribe] retry execute timeout tasks: %j', result);
    });
  }
}
