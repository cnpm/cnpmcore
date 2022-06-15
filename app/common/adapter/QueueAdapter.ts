import {
  AccessLevel,
  Inject,
  ContextProto,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class QueueAdapter {
  @Inject()
  private readonly redis: Redis;

  private getQueueName(key: string) {
    return `CNPMCORE_Q_${key}`;
  }

  async push<T>(key: string, item: T) {
    return await this.redis.lpush(this.getQueueName(key), JSON.stringify(item));
  }

  async pop<T>(key: string) {
    const json = await this.redis.rpop(this.getQueueName(key));
    if (!json) return null;
    return JSON.parse(json) as T;
  }

  async length(key: string) {
    return await this.redis.llen(this.getQueueName(key));
  }
}
