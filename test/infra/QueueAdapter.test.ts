import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';
import Redis from 'ioredis';

import { RedisQueueAdapter } from '../../app/infra/QueueAdapter.ts';

describe('test/infra/QueueAdapter.test.ts', () => {
  let queueAdapter: RedisQueueAdapter;

  beforeEach(async () => {
    queueAdapter = await app.getEggObject(RedisQueueAdapter);
  });

  it('should use the project Redis client', () => {
    assert.equal(app.config.redis.Redis, Redis);
    assert.ok('protocol' in app.redis.options);
    assert.equal(app.redis.options.protocol, 3);
  });

  it('should not push duplicate task', async () => {
    const queueName = 'duplicate_test';
    const taskId = 'task_id_1';
    let res = await queueAdapter.push(queueName, taskId);
    assert.ok(res === true);
    res = await queueAdapter.push(queueName, taskId);
    assert.ok(res === false);
    const length = await queueAdapter.length(queueName);
    assert.ok(length === 1);
    const queueTaskId = await queueAdapter.pop(queueName);
    assert.ok(queueTaskId === taskId);
  });

  it('should pop tasks in insertion order and return null when empty', async () => {
    const queueName = 'ordered_test';
    const tasks = [{ taskId: 'first' }, { taskId: 'second' }];
    assert.equal(await queueAdapter.pop(queueName), null);
    for (const task of tasks) {
      assert.equal(await queueAdapter.push(queueName, task), true);
    }
    assert.equal(await queueAdapter.length(queueName), tasks.length);
    for (const task of tasks) {
      assert.deepEqual(await queueAdapter.pop(queueName), task);
    }
    assert.equal(await queueAdapter.length(queueName), 0);
    assert.equal(await queueAdapter.pop(queueName), null);
  });
});
