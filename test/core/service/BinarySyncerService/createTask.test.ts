import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { BinarySyncerService } from 'app/core/service/BinarySyncerService';

describe('test/core/service/BinarySyncerService/createTask.test.ts', () => {
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    binarySyncerService = await app.getEggObject(BinarySyncerService);
  });

  describe('createTask()', () => {
    it('should ignore duplicate binary task', async () => {
      const task = await binarySyncerService.createTask('banana', {});
      const newTask = await binarySyncerService.createTask('banana', {});
      assert(task?.taskId === newTask?.taskId);
      assert(task?.bizId === 'SyncBinary:banana');
    });
  });
});