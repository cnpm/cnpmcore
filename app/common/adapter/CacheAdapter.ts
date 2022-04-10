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

  async lock(key: string, seconds: number) {
    const existsTimestamp = await this.redis.get(key);
    if (existsTimestamp) {
      if (Date.now() - parseInt(existsTimestamp) < seconds * 1000) {
        return null;
      }
      // lock timeout, delete it
      await this.redis.del(key);
    }
    const timestamp = `${Date.now() + seconds * 1000}`;
    const code = await this.redis.setnx(key, timestamp);
    // setnx fail, lock fail
    if (code === 0) return null;
    // expire
    await this.redis.expire(key, seconds);
    return timestamp;
  }

  async unlock(key: string, lockTimestamp: string) {
    const existsTimestamp = await this.redis.get(key);
    if (!existsTimestamp || lockTimestamp !== existsTimestamp) return;
    await this.redis.del(key);
  }

  async usingLock(key: string, seconds: number, func: () => Promise<void>) {
    const lockTimestamp = await this.lock(key, seconds);
    if (!lockTimestamp) return;
    try {
      await func();
    } finally {
      await this.unlock(key, lockTimestamp);
    }
  }
}
