import { app } from 'egg-mock/bootstrap';
import assert from 'assert';
import { HookTriggerWorker } from '../../../app/core/woker/HookTriggerWorker';

describe('test/core/worker/HookTriggerWorker.test.ts', () => {
  let hookTriggerWorker: HookTriggerWorker;

  beforeEach(async () => {
    hookTriggerWorker = await app.getEggObject(HookTriggerWorker);
  });

  describe('initWorker', () => {
    it('should init worker', async () => {
      await app.ready();
      assert.equal(hookTriggerWorker.configKey, 'triggerHookWorkerMaxConcurrentTasks');
      assert.equal(hookTriggerWorker.queueKey, 'trigger_hook');
    });
  });
});
