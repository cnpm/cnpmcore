import assert from 'node:assert/strict';
import { app, mm } from '@eggjs/mock/bootstrap';

import { TaskService } from '../../../../app/core/service/TaskService.js';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService.js';
import { TaskState, TaskType } from '../../../../app/common/enum/Task.js';
import { RedisQueueAdapter } from '../../../../app/infra/QueueAdapter.js';

describe('test/core/service/TaskService/findExecuteTask.test.ts', () => {
  let taskService: TaskService;
  let packageSyncerService: PackageSyncerService;
  let queueAdapter: RedisQueueAdapter;

  beforeEach(async () => {
    taskService = await app.getEggObject(TaskService);
    packageSyncerService = await app.getEggObject(PackageSyncerService);
    queueAdapter = await app.getEggObject(RedisQueueAdapter);
  });

  describe('findExecuteTask()', () => {
    it('should get a task to execute', async () => {
      let task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(!task);

      const newTask = await packageSyncerService.createTask('foo');
      assert.ok(newTask);
      app.expectLog(/queue size: 1/);
      assert.ok(!newTask.data.taskWorker);
      // same task not create again
      const newTask2 = await packageSyncerService.createTask('foo');
      assert.ok(newTask2);
      assert.ok(newTask2.taskId === newTask.taskId);
      assert.ok(!newTask2.data.taskWorker);
      app.expectLog(/queue size: 1/);

      // find other task type
      task = await taskService.findExecuteTask(TaskType.SyncBinary);
      assert.ok(!task);

      task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(task);
      assert.ok(task.targetName === 'foo');
      assert.ok(task.taskId === newTask.taskId);
      assert.ok(task.data.taskWorker);
      assert.ok(task.state === TaskState.Processing);

      // find again will null
      task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(!task);
    });

    it('should get multi tasks to execute', async () => {
      for (let i = 0; i < 10; i++) {
        await packageSyncerService.createTask(`foo-${i}`);
      }
      for (let i = 0; i < 10; i++) {
        const task = await taskService.findExecuteTask(TaskType.SyncPackage);
        assert.ok(task);
      }
      let task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(!task);
      await packageSyncerService.createTask('foo');
      task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(task);
      task = await taskService.findExecuteTask(TaskType.SyncPackage);
      assert.ok(!task);
    });

    it('should check task state before execute', async () => {
      const task1 = await packageSyncerService.createTask('foo-1');
      const task2 = await packageSyncerService.createTask('foo-2');
      // task 已被执行成功
      await taskService.finishTask(task1, TaskState.Success, '');

      const executeTask = await taskService.findExecuteTask(task1.type);

      // 直接返回下一个 task2
      assert.equal(executeTask?.taskId, task2.taskId);
    });

    it('should return null when no valid task', async () => {
      const task1 = await packageSyncerService.createTask('foo-1');
      // task 已被执行成功
      await taskService.finishTask(task1, TaskState.Success, '');

      const executeTask = await taskService.findExecuteTask(task1.type);

      // 直接返回下一个 task2
      assert.equal(executeTask, null);
    });

    it('should not task which take be other', async () => {
      const task1 = await packageSyncerService.createTask('foo-1');
      const task2 = await packageSyncerService.createTask('foo-2');
      // mock pop get duplicate taskId
      const popResult = [task1.taskId, task1.taskId, task2.taskId];
      let times = 0;
      mm(queueAdapter, 'pop', async () => {
        return popResult[times++];
      });
      const tasks = await Promise.all([
        taskService.findExecuteTask(task1.type),
        taskService.findExecuteTask(task1.type),
      ]);
      assert.ok(tasks[0]?.taskId !== tasks[1]?.taskId);
    });
  });
});
