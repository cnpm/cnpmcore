import {
  AccessLevel,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';
import { JobsOptions, Queue } from 'bullmq';
import { JobData, MQAdapterType } from '../common/typing';

/**
 * Use sort set to keep queue in order and keep same value only insert once
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
  name: 'mqAdapter',
})
export class MQAdapter implements MQAdapterType {
  @Inject()
  private readonly redis: Redis; // 由 redis 插件引入

  private queueMap: Record<string, Queue> = {};

  private getQueueName(key: string) {
    return `CNPMCORE_MQ_V1_${key}`;
  }

  initQueue(key: string) {
    const queueName = this.getQueueName(key);
    if (!this.queueMap[key]) {
      this.queueMap[key] = new Queue(queueName, {
        connection: this.redis,
      });
    }

    return this.queueMap[key];
  }

  /**
   * If queue has the same item, return false
   * If queue not has the same item, return true
   */
  async addJobs(key: string, { taskId, targetName } : JobData, options?: JobsOptions): Promise<boolean> {
    try {
      const queue = this.initQueue(key);
      await queue.add(key, { taskId, targetName },
        {
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          // remove duplicate job
          jobId: taskId,
          ...options,
        },
      );
      return true;
    } catch (e) {
      return false;
    }
  }
}
