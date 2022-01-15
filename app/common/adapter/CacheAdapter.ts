import {
  SingletonProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';

const ONE_DAY = 3600 * 24;

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class CacheAdapter {
  @Inject()
  private readonly redis: Redis;

  async setBytes(key: string, bytes: Buffer) {
    await this.redis.setex(key, ONE_DAY, bytes);
  }

  async getBytes(key: string) {
    return await this.redis.getBuffer(key);
  }

  async set(key: string, text: string) {
    await this.redis.setex(key, ONE_DAY, text);
  }

  async get(key: string) {
    return await this.redis.get(key);
  }

  async delete(key: string) {
    await this.redis.del(key);
  }
}
