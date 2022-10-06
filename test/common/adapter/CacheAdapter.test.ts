import assert = require('assert');
import { setTimeout } from 'timers/promises';
import { app } from 'egg-mock/bootstrap';
import { CacheAdapter } from '../../../app/common/adapter/CacheAdapter';

describe('test/common/adapter/CacheAdapter.test.ts', () => {
  let cache: CacheAdapter;

  beforeEach(async () => {
    const ctx = await app.mockModuleContext();
    cache = await ctx.getEggObject(CacheAdapter);
  });

  describe('lock(), unlock()', () => {
    it('should work', async () => {
      const lockId = await cache.lock('unittest', 1);
      assert(lockId);
      assert(typeof lockId === 'string');
      const lockId2 = await cache.lock('unittest', 1);
      assert(!lockId2);
      const lockId3 = await cache.lock('unittest', 1);
      assert(!lockId3);
      await setTimeout(1100);
      // lock timeout
      const lockId4 = await cache.lock('unittest', 1);
      assert(lockId4);
      assert(typeof lockId4 === 'string');
      assert(lockId4 !== lockId);
      // unlock wrong
      await cache.unlock('unittest', lockId);
      const lockId5 = await cache.lock('unittest', 1);
      assert(!lockId5);
      // unlock success
      await cache.unlock('unittest', lockId4);
      const lockId6 = await cache.lock('unittest', 1);
      assert(lockId6);
      // unlock not exists key
      await cache.unlock('unittest-not-exists', lockId6);
      const lockId7 = await cache.lock('unittest', 1);
      assert(!lockId7);
    });

    it('should work on concurrency', async () => {
      // lock concurrency tests
      const locks = await Promise.all([
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
        cache.lock('unittest-concurrency', 1),
      ]);
      assert(locks.filter(lockId => !!lockId).length === 1);
    });

    it('should mock lock timeout', async () => {
      const lockId = await cache.lock('unittest', 10);
      assert(lockId);
      const lockId2 = await cache.lock('unittest', 10);
      assert(!lockId2);
      await cache.set('unittest', '123');
      // lock timeout, use new lock
      const lockId3 = await cache.lock('CNPMCORE_L_unittest', 10);
      assert(lockId3);
    });
  });
});
