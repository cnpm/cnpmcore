import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { RedisQueueAdapter } from '../../app/infra/QueueAdapter.ts';

describe('test/infra/QueueAdapter.test.ts', () => {
  let queueAdapter: RedisQueueAdapter;

  beforeEach(async () => {
    queueAdapter = await app.getEggObject(RedisQueueAdapter);
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
});
