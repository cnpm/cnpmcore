import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { setTimeout } from 'timers/promises';
import { TaskRepository } from 'app/repository/TaskRepository';
import { Task as TaskModel } from 'app/repository/model/Task';
import { ChangesStreamTaskData, Task, TaskData } from '../../app/core/entity/Task';
import { TaskState, TaskType } from '../../app/common/enum/Task';
import os from 'os';
import { EasyData, EntityUtil } from '../../app/core/util/EntityUtil';

describe('test/repository/TaskRepository.test.ts', () => {
  let ctx: Context;

  let taskRepository: TaskRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    taskRepository = await ctx.getEggObject(TaskRepository);
    await TaskModel.truncate();
  });

  afterEach(async () => {
    await TaskModel.truncate();
    await app.destroyModuleContext(ctx);
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
      assert(task1.id);
      assert(task2.id);
      assert(task1.id === task2.id);
      assert(task1.taskId);
      assert(task2.taskId);
      assert(task1.taskId === task2.taskId);
    });

    it('should update changesStream syncData', async () => {
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
      await taskRepository.saveTask(task1);

      const originTask = await taskRepository.findTask(task1.taskId) as Task;
      originTask.updateSyncData({ lastSince: '9527', taskCount: 0 });
      await setTimeout(1000);
      await taskRepository.saveTask(originTask);
      const firstUpdated = originTask.updatedAt;

      originTask.updateSyncData({ lastSince: '9527', taskCount: 0 });
      await setTimeout(1000);
      await taskRepository.saveTask(originTask);
      const secondUpdated = originTask.updatedAt;

      assert(secondUpdated.getTime() - firstUpdated.getTime() >= 1000);

    });
  });
});
