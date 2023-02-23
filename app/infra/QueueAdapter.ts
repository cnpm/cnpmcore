import {
  AccessLevel,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';
import { QueueAdapter } from '../common/typing';

/**
 * Use sort set to keep queue in order and keep same value only insert once
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
  name: 'queueAdapter',
})
export class RedisQueueAdapter implements QueueAdapter {
  @Inject()
  private readonly redis: Redis; // 由 redis 插件引入

  private getQueueName(key: string) {
    return `CNPMCORE_Q_V2_${key}`;
  }

  private getQueueScoreName(key: string) {
    return `CNPMCORE_Q_S_V2_${key}`;
  }

  /**
   * If queue has the same item, return false
   * If queue not has the same item, return true
   */
  async push<T>(key: string, item: T): Promise<boolean> {
    const score = await this.redis.incr(this.getQueueScoreName(key));
    const res = await this.redis.zadd(this.getQueueName(key), score, JSON.stringify(item));
    return res !== 0;
  }

  async pop<T>(key: string) {
    const [ json ] = await this.redis.zpopmin(this.getQueueName(key));
    if (!json) return null;
    return JSON.parse(json) as T;
  }

  async length(key: string) {
    return await this.redis.zcount(this.getQueueName(key), '-inf', '+inf');
  }
}
