import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import assert from 'assert';
import { RedisQueueAdapter } from '../../app/infra/QueueAdapter';

describe('test/infra/QueueAdapter.test.ts', () => {
  let ctx: Context;
  let queueAdapter: RedisQueueAdapter;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    queueAdapter = await ctx.getEggObject(RedisQueueAdapter);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
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
