import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { setTimeout } from 'timers/promises';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService';
import { TestUtil } from '../../../TestUtil';
import { Task } from 'app/core/entity/Task';
import { TaskState } from '../../../../app/common/enum/Task';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskService } from '../../../../app/core/service/TaskService';

describe('test/core/service/PackageSyncerService/createTask.test.ts', () => {
  let ctx: Context;
  const pkgName = '@cnpmcore/foo';
  const username = 'mock_username';
  let packageSyncerService: PackageSyncerService;
  let taskRepository: TaskRepository;
  let taskService: TaskService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
    taskRepository = await ctx.getEggObject(TaskRepository);
    taskService = await ctx.getEggObject(TaskService);

    await TestUtil.createPackage({
      name: pkgName,
      registryId: 'mock_registry_id',
      isPrivate: false,
    }, {
      name: username,
    });
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should ignore if registryId not same', async () => {
    await assert.rejects(async () => {
      await packageSyncerService.createTask(pkgName, {
        registryId: 'sync_registry_id',
      });
    }, /package @cnpmcore\/foo is not in registry sync_registry_id/);
  });

  it('should work when registryId is null', async () => {
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    await TestUtil.createPackage({
      name: 'binary-mirror-config',
      isPrivate: false,
    }, {
      name: username,
    });

    const task = await packageSyncerService.createTask('binary-mirror-config', {
      registryId: 'sync_registry_id',
    });
    assert(task);
  });

  it('should work when pkg not exists', async () => {
    const task = await packageSyncerService.createTask('binary-mirror-config-not-exists', {
      registryId: 'sync_registry_id',
    });
    assert(task);
  });

  it('should create task when processing', async () => {
    mock(PackageSyncerService.prototype, 'executeTask', async (task: Task) => {
      task.state = TaskState.Processing;
      await taskRepository.saveTask(task);
      await setTimeout(2);
      await taskService.finishTask(task, TaskState.Success);
    });
    const task = await packageSyncerService.createTask(pkgName);
    const res = await Promise.all([ packageSyncerService.executeTask(task), (async () => {
      await setTimeout(1);
      return await packageSyncerService.createTask(pkgName);
    })() ]);
    assert(res[1].taskId !== task.taskId);
  });

  it('should not duplicate task when waiting', async () => {
    const task = await packageSyncerService.createTask(pkgName);
    const newTask = await packageSyncerService.createTask(pkgName);
    assert(newTask.taskId === task.taskId);
  });
});
