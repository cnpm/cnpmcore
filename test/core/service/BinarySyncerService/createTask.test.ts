import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { BinarySyncerService } from 'app/core/service/BinarySyncerService';

describe('test/core/service/BinarySyncerService/createTask.test.ts', () => {
  let ctx: Context;
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    binarySyncerService = await ctx.getEggObject(BinarySyncerService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
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
