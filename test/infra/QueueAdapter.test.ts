import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { RedisQueueAdapter } from '../../app/infra/QueueAdapter';

describe('test/infra/QueueAdapter.test.ts', () => {
  let queueAdapter: RedisQueueAdapter;

  beforeEach(async () => {
    queueAdapter = await app.getEggObject(RedisQueueAdapter);
  });

  it('should not push duplicate task', async () => {
    const queueName = 'duplicate_test';
    const taskId = 'task_id_1';
    let res = await queueAdapter.push(queueName, taskId);
    assert(res === true);
    res = await queueAdapter.push(queueName, taskId);
    assert(res === false);
    const length = await queueAdapter.length(queueName);
    assert(length === 1);
    const queueTaskId = await queueAdapter.pop(queueName);
    assert(queueTaskId === taskId);
  });
});
