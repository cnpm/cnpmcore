import { app } from 'egg-mock/bootstrap';
import assert from 'assert';
import { AbstractWorker } from '../../../app/core/woker/AbstractWorker';

describe('test/core/worker/HookTriggerWorker.test.ts', () => {

  describe('trigger check constructor', () => {
    it('should throw error', async () => {
      await assert.rejects(async () => {
        class InvalidWorker extends AbstractWorker {
        }
        await (new InvalidWorker(app)).registerWorker();
      }, /initWorkerInfo not implemented/);
    });
  });

});
