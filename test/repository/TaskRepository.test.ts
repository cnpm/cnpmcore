import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import os from 'node:os';
import { app } from '@eggjs/mock/bootstrap';

import { TaskRepository } from '../../app/repository/TaskRepository.js';
import { Task as TaskModel } from '../../app/repository/model/Task.js';
import {
  Task,
  type TaskData,
  type ChangesStreamTaskData,
} from '../../app/core/entity/Task.js';
import { EntityUtil, type EasyData } from '../../app/core/util/EntityUtil.js';
import { TaskState, TaskType } from '../../app/common/enum/Task.js';

describe('test/repository/TaskRepository.test.ts', () => {
  let taskRepository: TaskRepository;

  beforeEach(async () => {
    taskRepository = await app.getEggObject(TaskRepository);
    await TaskModel.truncate();
  });

  afterEach(async () => {
    await TaskModel.truncate();
  });

  describe('unique biz id', () => {
    it('should save succeed if biz id is equal', async () => {
      const bizId = 'mock_dup_biz_id';
      const data: EasyData<TaskData<ChangesStreamTaskData>, 'taskId'> = {
        type: TaskType.ChangesStream,
        state: TaskState.Waiting,
        targetName: 'foo',
        authorId: `pid_${process.pid}`,
        authorIp: os.hostname(),
        data: {
          taskWorker: '',
          since: '',
        },
        bizId,
      };
      const newData = EntityUtil.defaultData(data, 'taskId');
      const task1 = new Task(newData);
      const task2 = new Task(newData);
      await Promise.all([
        taskRepository.saveTask(task1),
        taskRepository.saveTask(task2),
      ]);
      assert.ok(task1.id);
      assert.ok(task2.id);
      assert.ok(task1.id === task2.id);
      assert.ok(task1.taskId);
      assert.ok(task2.taskId);
      assert.ok(task1.taskId === task2.taskId);
    });

    it('should update updatedAt', async () => {
      const bizId = 'mock_dup_biz_id';
      const data: EasyData<TaskData<ChangesStreamTaskData>, 'taskId'> = {
        type: TaskType.ChangesStream,
        state: TaskState.Waiting,
        targetName: 'foo',
        authorId: `pid_${process.pid}`,
        authorIp: os.hostname(),
        data: {
          taskWorker: '',
          since: '',
        },
        bizId,
      };
      // 首先创建一个 task1
      const newData = EntityUtil.defaultData(data, 'taskId');
      const task1 = new Task(newData);
      // 持久化保存 task1
      await taskRepository.saveTask(task1);
      // 再取一个 asyncTask ，两者指向相同的数据行
      const asyncTask = (await taskRepository.findTask(task1.taskId)) as Task;

      // task1 对应的数据被更新了
      await setTimeout(1);
      task1.updatedAt = new Date();
      await taskRepository.saveTask(task1);

      await setTimeout(1);
      asyncTask.updateSyncData({ lastSince: '9527', taskCount: 1 });
      // 再执行 saveTask 的时候，会通过 id 重新查询一次 db 中的 model
      // 由于已经被 task1 更新，所以会导致 asyncTask.updatedAd 会覆盖 model
      await taskRepository.saveTask(asyncTask);

      assert.ok(
        asyncTask.updatedAt.getTime() !== asyncTask.createdAt.getTime()
      );
    });

    it('cant modify updatedAt', async () => {
      const bizId = 'mock_dup_biz_id';
      const data: EasyData<TaskData<ChangesStreamTaskData>, 'taskId'> = {
        type: TaskType.ChangesStream,
        state: TaskState.Waiting,
        targetName: 'foo',
        authorId: `pid_${process.pid}`,
        authorIp: os.hostname(),
        data: {
          taskWorker: '',
          since: '',
        },
        bizId,
      };

      // 首先创建一个 task1
      const newData = EntityUtil.defaultData(data, 'taskId');
      const task1 = new Task(newData);
      const lastSince = new Date();
      await setTimeout(100);
      task1.updatedAt = lastSince;
      await taskRepository.saveTask(task1);

      assert.ok(task1.updatedAt.getTime() >= lastSince.getTime());
    });
  });

  describe('idempotentSaveTask', () => {
    let task: Task;
    beforeEach(async () => {
      const bizId = 'mock_dup_biz_id';
      const data: EasyData<TaskData<ChangesStreamTaskData>, 'taskId'> = {
        type: TaskType.ChangesStream,
        state: TaskState.Waiting,
        targetName: 'foo',
        authorId: `pid_${process.pid}`,
        authorIp: os.hostname(),
        data: {
          taskWorker: '',
          since: '',
        },
        bizId,
      };
      // 首先创建一个 task1
      const newData = EntityUtil.defaultData(data, 'taskId');
      task = new Task(newData);
      // 持久化保存 task1
      await taskRepository.saveTask(task);
    });

    it('should only save one', async () => {
      const condition = task.start();
      const [firstSave, secondSave] = await Promise.all([
        taskRepository.idempotentSaveTask(task, condition),
        taskRepository.idempotentSaveTask(task, condition),
      ]);
      assert.ok(firstSave !== secondSave);
    });
  });
});
