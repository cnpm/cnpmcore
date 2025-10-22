import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService.ts';
import { Task as TaskModel } from '../../../../app/repository/model/Task.ts';
import { HistoryTask as HistoryTaskModel } from '../../../../app/repository/model/HistoryTask.ts';
import { TaskService } from '../../../../app/core/service/TaskService.ts';

describe('test/core/service/PackageSyncerService/findExecuteTask.test.ts', () => {
  let packageSyncerService: PackageSyncerService;
  let taskService: TaskService;

  beforeEach(async () => {
    packageSyncerService = await app.getEggObject(PackageSyncerService);
    taskService = await app.getEggObject(TaskService);
  });

  describe('findExecuteTask()', () => {
    it('should get a task to execute', async () => {
      let task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);

      await packageSyncerService.createTask('foo');
      await packageSyncerService.createTask('bar');
      await packageSyncerService.createTask('ok');
      const task1 = await packageSyncerService.findExecuteTask();
      assert.ok(task1);
      assert.ok(task1.state === 'processing');
      assert.ok(task1.updatedAt > task1.createdAt);
      assert.ok(task1.attempts === 1);
      // console.log(task1, task1.updatedAt.getTime() - task1.createdAt.getTime());
      const task2 = await packageSyncerService.findExecuteTask();
      assert.ok(task2);
      assert.ok(task2.state === 'processing');
      assert.ok(task2.updatedAt > task2.createdAt);
      assert.ok(task1.attempts === 1);
      // console.log(task2, task2.updatedAt.getTime() - task2.createdAt.getTime());
      const task3 = await packageSyncerService.findExecuteTask();
      assert.ok(task3);
      assert.ok(task3.state === 'processing');
      assert.ok(task3.updatedAt > task3.createdAt);
      assert.ok(task1.attempts === 1);
      // console.log(task3, task3.updatedAt.getTime() - task3.createdAt.getTime());
      assert.ok(task3.id);
      assert.ok(task2.id);
      assert.ok(task1.id);
      assert.ok(task3.id > task2.id);
      assert.ok(task2.id > task1.id);

      // again will empty
      task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);

      // mock timeout
      await TaskModel.update(
        { id: task3.id },
        {
          updatedAt: new Date(task3.updatedAt.getTime() - 60_000 * 10 - 1),
          logStorePosition: '123',
        }
      );
      app.mockLog();
      await taskService.retryExecuteTimeoutTasks();
      app.expectLog('[TaskService.retryExecuteTimeoutTasks:retry]');

      task = await packageSyncerService.findExecuteTask();
      assert.ok(task);
      assert.ok(task.id === task3.id);
      assert.ok(task.updatedAt > task3.updatedAt);
      assert.ok(task.attempts === 2);
      assert.ok(task.logPath.endsWith('-1.log'));
      assert.ok(task.logStorePosition === '');

      // again will empty
      task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);

      // attempts > 3 will be set to timeout task and save to history
      await TaskModel.update(
        { id: task3.id },
        { updatedAt: new Date(task3.updatedAt.getTime() - 60_000 * 10 - 1) }
      );
      app.mockLog();
      await taskService.retryExecuteTimeoutTasks();
      app.expectLog('[TaskService.retryExecuteTimeoutTasks:retry]');

      task = await packageSyncerService.findExecuteTask();
      assert.ok(task);
      assert.ok(task.attempts === 3);
      assert.ok(task.logPath.endsWith('-2.log'));

      await TaskModel.update(
        { id: task3.id },
        { updatedAt: new Date(task3.updatedAt.getTime() - 60_000 * 10 - 1) }
      );
      app.mockLog();
      let result = await taskService.retryExecuteTimeoutTasks();
      assert.ok(result.processing === 1);
      assert.ok(result.waiting === 0);
      app.expectLog('[TaskService.retryExecuteTimeoutTasks:timeout]');

      // again should not effect
      result = await taskService.retryExecuteTimeoutTasks();
      assert.ok(result.processing === 0);
      assert.ok(result.waiting === 0);

      task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);
      const history = await HistoryTaskModel.findOne({ taskId: task3.taskId });
      assert.ok(history);
      assert.ok(history.state === 'timeout');
      assert.ok(history.attempts === 3);
      assert.ok(!(await TaskModel.findOne({ id: task3.id })));
    });

    it('should mock waiting timeout task', async () => {
      let task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);

      task = await packageSyncerService.createTask('foo');

      // mock timeout 10mins
      await TaskModel.update(
        { id: task.id },
        {
          updatedAt: new Date(task.updatedAt.getTime() - 60_000 * 10 - 1),
        }
      );
      let result = await taskService.retryExecuteTimeoutTasks();
      assert.ok(result.processing === 0);
      assert.ok(result.waiting === 0);

      // mock timeout 30mins
      await TaskModel.update(
        { id: task.id },
        {
          updatedAt: new Date(task.updatedAt.getTime() - 60_000 * 30 - 1),
        }
      );
      app.mockLog();
      result = await taskService.retryExecuteTimeoutTasks();
      app.expectLog('[TaskService.retryExecuteTimeoutTasks:retryWaiting]');
      assert.ok(result.processing === 0);
      assert.ok(result.waiting === 1);

      result = await taskService.retryExecuteTimeoutTasks();
      assert.ok(result.processing === 0);
      assert.ok(result.waiting === 0);

      // has one tasks in queue
      task = await packageSyncerService.findExecuteTask();
      assert.ok(task);
      task = await packageSyncerService.findExecuteTask();
      assert.ok(!task);
    });
  });
});
