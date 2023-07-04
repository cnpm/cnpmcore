import assert from 'assert';
import { Job, Worker } from 'bullmq';
import { app } from 'egg-mock/bootstrap';
import { MQAdapter } from '../../app/infra/MQAdapter';

describe('test/infra/MQAdapter.test.ts', () => {
  let mqAdapter: MQAdapter;

  beforeEach(async () => {
    mqAdapter = await app.getEggObject(MQAdapter);
  });

  it('should remove duplicate task', async () => {
    const queue = mqAdapter.initQueue('banana');

    await mqAdapter.addJobs('banana', { taskId: '1', targetName: 'okk' });
    await mqAdapter.addJobs('banana', { taskId: '2', targetName: 'okk' });
    await mqAdapter.addJobs('banana', { taskId: '1', targetName: 'okk' });

    const len = await queue.count();
    assert.equal(len, 2);

  });

  it('should retry failed task', async () => {

    const queue = mqAdapter.initQueue('orange');

    // retry 2 time;
    await mqAdapter.addJobs('orange', { taskId: '3', targetName: 'apple' }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1,
      },
    });

    let failed = 0;

    const worker = new Worker(queue.name, async (job: Job) => {
      // console.log(job.attemptsMade);
      if (failed < 2) {
        throw new Error(`${job.data.taskId} error`);
      }
    });

    worker.on('failed', job => {
      // console.log('failed', job?.data?.taskId);
      job && failed++;
    });

    let completedJob;

    await (async () => {
      return new Promise(resolve => {
        worker.on('completed', job => {
          completedJob = job;
          resolve(null);
        });
      });
    })();

    const len = await queue.count();
    assert.equal(len, 0);
    assert(completedJob);
  });

});
