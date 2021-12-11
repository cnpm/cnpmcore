import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { Task as TaskModel } from 'app/repository/model/Task';
import { HistoryTask as HistoryTaskModel } from 'app/repository/model/HistoryTask';

describe('test/core/service/PackageSyncerService/executeTask.test.ts', () => {
  let ctx: Context;
  let packageSyncerService: PackageSyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('executeTask()', () => {
    it('should get a task to execute', async () => {
      let task = await packageSyncerService.executeTask();
      assert(!task);

      await packageSyncerService.createTask('foo', '', '');
      await packageSyncerService.createTask('foo', '', '');
      await packageSyncerService.createTask('foo', '', '');
      const task1 = await packageSyncerService.executeTask();
      assert(task1);
      assert.equal(task1.state, 'processing');
      assert(task1.updatedAt > task1.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task1, task1.updatedAt.getTime() - task1.createdAt.getTime());
      const task2 = await packageSyncerService.executeTask();
      assert(task2);
      assert.equal(task2.state, 'processing');
      assert(task2.updatedAt > task2.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task2, task2.updatedAt.getTime() - task2.createdAt.getTime());
      const task3 = await packageSyncerService.executeTask();
      assert(task3);
      assert.equal(task3.state, 'processing');
      assert(task3.updatedAt > task3.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task3, task3.updatedAt.getTime() - task3.createdAt.getTime());
      assert(task3.id > task2.id);
      assert(task2.id > task1.id);

      // again will empty
      task = await packageSyncerService.executeTask();
      assert(!task);

      // mock timeout
      await TaskModel.update({ id: task3.id }, { updatedAt: new Date(task3.updatedAt.getTime() - 60000 * 5 - 1) });
      task = await packageSyncerService.executeTask();
      assert(task);
      assert.equal(task.id, task3.id);
      assert(task.updatedAt > task3.updatedAt);
      assert.equal(task.attempts, 2);

      // again will empty
      task = await packageSyncerService.executeTask();
      assert(!task);

      // attempts > 3 will be set to timeout task and save to history
      await TaskModel.update({ id: task3.id }, { updatedAt: new Date(task3.updatedAt.getTime() - 60000 * 5 - 1) });
      task = await packageSyncerService.executeTask();
      assert(task);
      assert.equal(task.attempts, 3);
      await TaskModel.update({ id: task3.id }, { updatedAt: new Date(task3.updatedAt.getTime() - 60000 * 5 - 1) });
      task = await packageSyncerService.executeTask();
      assert(!task);
      const history = await HistoryTaskModel.findOne({ taskId: task3.taskId });
      assert(history);
      assert.equal(history.state, 'timeout');
      assert.equal(history.attempts, 3);
      assert(!await TaskModel.findOne({ id: task3.id }));
    });
  });
});
