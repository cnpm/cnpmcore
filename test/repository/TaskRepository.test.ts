import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { setTimeout } from 'timers/promises';
import { TaskRepository } from '../../app/repository/TaskRepository';
import { Task as TaskModel } from '../../app/repository/model/Task';
import { ChangesStreamTaskData, Task, TaskData } from '../../app/core/entity/Task';
import { TaskState, TaskType } from '../../app/common/enum/Task';
import os from 'os';
import { EasyData, EntityUtil } from '../../app/core/util/EntityUtil';

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
      assert(task1.id);
      assert(task2.id);
      assert(task1.id === task2.id);
      assert(task1.taskId);
      assert(task2.taskId);
      assert(task1.taskId === task2.taskId);
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
      const asyncTask = await taskRepository.findTask(task1.taskId) as Task;

      // task1 对应的数据被更新了
      await setTimeout(1);
      task1.updatedAt = new Date();
      await taskRepository.saveTask(task1);

      await setTimeout(1);
      asyncTask.updateSyncData({ lastSince: '9527', taskCount: 1 });
      // 再执行 saveTask 的时候，会通过 id 重新查询一次 db 中的 model
      // 由于已经被 task1 更新，所以会导致 asyncTask.updatedAd 会覆盖 model
      await taskRepository.saveTask(asyncTask);

      assert(asyncTask.updatedAt.getTime() !== asyncTask.createdAt.getTime());
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
      await setTimeout(1);
      task1.updatedAt = lastSince;
      await taskRepository.saveTask(task1);

      assert(task1.updatedAt.getTime() > lastSince.getTime());
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
      const [ firstSave, secondSave ] = await Promise.all([
        taskRepository.idempotentSaveTask(task, condition),
        taskRepository.idempotentSaveTask(task, condition),
      ]);
      assert(firstSave !== secondSave);
    });
  });
});
