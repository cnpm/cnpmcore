import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app, mock } from '@eggjs/mock/bootstrap';

import { CacheAdapter } from '../../../app/common/adapter/CacheAdapter.js';

describe('test/common/adapter/CacheAdapter.test.ts', () => {
  let cache: CacheAdapter;

  beforeEach(async () => {
    cache = await app.getEggObject(CacheAdapter);
  });

  describe('lock(), unlock()', () => {
    it('should work', async () => {
      const lockId = await cache.lock('unittest', 1);
      assert.ok(lockId);
      assert.equal(typeof lockId, 'string');
      const lockId2 = await cache.lock('unittest', 1);
      assert.ok(!lockId2);
      const lockId3 = await cache.lock('unittest', 1);
      assert.ok(!lockId3);
      await setTimeout(1100);
      // lock timeout
      const lockId4 = await cache.lock('unittest', 1);
      assert.ok(lockId4);
      assert.equal(typeof lockId4, 'string');
      assert.notEqual(lockId4, lockId);
      // unlock wrong
      await cache.unlock('unittest', lockId);
      const lockId5 = await cache.lock('unittest', 1);
      assert.ok(!lockId5);
      // unlock success
      await cache.unlock('unittest', lockId4);
      const lockId6 = await cache.lock('unittest', 1);
      assert.ok(lockId6);
      // unlock not exists key
      await cache.unlock('unittest-not-exists', lockId6);
      const lockId7 = await cache.lock('unittest', 1);
      assert.ok(!lockId7);
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
      assert.ok(locks.filter(lockId => !!lockId).length === 1);
    });

    it('should mock lock timeout', async () => {
      const lockId = await cache.lock('CNPMCORE_L_unittest', 10);
      assert.ok(lockId);
      const lockId2 = await cache.lock('CNPMCORE_L_unittest', 10);
      assert.ok(!lockId2);
      // mock get return existsTimestamp > now
      mock.data(app.redis, 'get', `${Date.now() - 123 * 1000}`);
      // lock timeout, use new lock
      const lockId3 = await cache.lock('CNPMCORE_L_unittest', 10);
      assert.ok(lockId3);
      assert.notEqual(lockId3, lockId);
    });
  });
});
