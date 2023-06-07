import { app, mock } from 'egg-mock/bootstrap';
import { TaskState } from '../../app/common/enum/Task';
import { PackageSyncerService } from '../../app/core/service/PackageSyncerService';
import { HistoryTask } from '../../app/repository/model/HistoryTask';
import { ModelConvertor } from '../../app/repository/util/ModelConvertor';
import { Task as TaskModel } from '../../app/repository/model/Task';
import { TaskService } from '../../app/core/service/TaskService';

const TaskTimeoutHandlerPath = require.resolve('../../app/port/schedule/TaskTimeoutHandler');

describe('test/schedule/TaskTimeoutHandler.test.ts', () => {
  it('should work', async () => {
    app.mockLog();
    await app.runSchedule(TaskTimeoutHandlerPath);
    app.expectLog('[TaskTimeoutHandler:subscribe] retry execute timeout tasks: {"processing":0,"waiting":0}');
    // again should work
    await app.runSchedule(TaskTimeoutHandlerPath);
  });

  it('should skip task when retry error', async () => {

    const packageSyncerService = await app.getEggObject(PackageSyncerService);

    const apple = await packageSyncerService.createTask('apple');
    const banana = await packageSyncerService.createTask('banana');

    // mock timeout 10mins
    await TaskModel.update({ id: apple.id }, {
      updatedAt: new Date(apple.updatedAt.getTime() - 60000 * 30 - 1),
      state: TaskState.Processing,
    });
    await TaskModel.update({ id: banana.id }, {
      updatedAt: new Date(banana.updatedAt.getTime() - 60000 * 40),
    });

    app.mockLog();
    mock(TaskService.prototype, 'retryTask', async () => {
      throw new Error('aba aba');
    });
    await app.runSchedule(TaskTimeoutHandlerPath);
    app.expectLog('[TaskService.retryExecuteTimeoutTasks:error] processing task');
    app.expectLog('[TaskService.retryExecuteTimeoutTasks:error] waiting task');
  });

  it('should modify history task', async () => {

    const packageSyncerService = await app.getEggObject(PackageSyncerService);

    await packageSyncerService.createTask('boo');
    const task = await packageSyncerService.createTask('foo');

    // mock task has been finished success
    await ModelConvertor.convertEntityToModel({ ...task, state: TaskState.Success, id: 9527 }, HistoryTask);

    // mock timeout 10mins
    await TaskModel.update({ id: task.id }, {
      updatedAt: new Date(task.updatedAt.getTime() - 60000 * 30 - 1),
    });

    app.mockLog();
    await app.runSchedule(TaskTimeoutHandlerPath);
    app.expectLog('[TaskTimeoutHandler:subscribe] retry execute timeout tasks');
  });
});
