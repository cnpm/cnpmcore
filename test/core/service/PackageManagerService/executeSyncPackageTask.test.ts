import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { Task as TaskModel } from 'app/repository/model/Task';

describe('test/core/service/PackageManagerService/executeSyncPackageTask.test.ts', () => {
  let ctx: Context;
  let packageManagerService: PackageManagerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageManagerService = await ctx.getEggObject(PackageManagerService);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('executeSyncPackageTask()', () => {
    it('should get a task to execute', async () => {
      let task = await packageManagerService.executeSyncPackageTask();
      assert(!task);

      await packageManagerService.createSyncPackageTask('foo', '', '');
      await packageManagerService.createSyncPackageTask('foo', '', '');
      await packageManagerService.createSyncPackageTask('foo', '', '');
      const task1 = await packageManagerService.executeSyncPackageTask();
      assert(task1);
      assert.equal(task1.state, 'processing');
      assert(task1.updatedAt > task1.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task1, task1.updatedAt.getTime() - task1.createdAt.getTime());
      const task2 = await packageManagerService.executeSyncPackageTask();
      assert(task2);
      assert.equal(task2.state, 'processing');
      assert(task2.updatedAt > task2.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task2, task2.updatedAt.getTime() - task2.createdAt.getTime());
      const task3 = await packageManagerService.executeSyncPackageTask();
      assert(task3);
      assert.equal(task3.state, 'processing');
      assert(task3.updatedAt > task3.createdAt);
      assert.equal(task1.attempts, 1);
      // console.log(task3, task3.updatedAt.getTime() - task3.createdAt.getTime());
      assert(task3.id > task2.id);
      assert(task2.id > task1.id);

      // again will empty
      task = await packageManagerService.executeSyncPackageTask();
      assert(!task);

      // mock timeout
      await TaskModel.update({ id: task3.id }, { updatedAt: new Date(task3.updatedAt.getTime() - 60000 * 5 - 1) });
      task = await packageManagerService.executeSyncPackageTask();
      assert(task);
      console.log(task);
      assert.equal(task.id, task3.id);
      assert(task.updatedAt > task3.updatedAt);
      assert.equal(task.attempts, 2);

      // again will empty
      task = await packageManagerService.executeSyncPackageTask();
      assert(!task);
    });
  });
});
