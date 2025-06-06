import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService.js';
import type { Task } from '../../../../app/core/entity/Task.js';
import { TaskState } from '../../../../app/common/enum/Task.js';
import { TaskRepository } from '../../../../app/repository/TaskRepository.js';
import { TaskService } from '../../../../app/core/service/TaskService.js';

describe('test/core/service/PackageSyncerService/createTask.test.ts', () => {
  const pkgName = '@cnpmcore/foo';
  const username = 'mock_username';
  let packageSyncerService: PackageSyncerService;
  let taskRepository: TaskRepository;
  let taskService: TaskService;

  beforeEach(async () => {
    packageSyncerService = await app.getEggObject(PackageSyncerService);
    taskRepository = await app.getEggObject(TaskRepository);
    taskService = await app.getEggObject(TaskService);

    await TestUtil.createPackage(
      {
        name: pkgName,
        registryId: 'mock_registry_id',
        isPrivate: false,
      },
      {
        name: username,
      }
    );
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
    await TestUtil.createPackage(
      {
        name: 'binary-mirror-config',
        isPrivate: false,
      },
      {
        name: username,
      }
    );

    const task = await packageSyncerService.createTask('binary-mirror-config', {
      registryId: 'sync_registry_id',
    });
    assert.ok(task);
  });

  it('should work when pkg not exists', async () => {
    const task = await packageSyncerService.createTask(
      'binary-mirror-config-not-exists',
      {
        registryId: 'sync_registry_id',
      }
    );
    assert.ok(task);
  });

  it('should merge task when processing', async () => {
    mock(packageSyncerService, 'executeTask', async (task: Task) => {
      task.state = TaskState.Processing;
      await taskRepository.saveTask(task);
      await setTimeout(2);
      await taskService.finishTask(task, TaskState.Success);
    });
    const task = await packageSyncerService.createTask(pkgName);
    const res = await Promise.all([
      packageSyncerService.executeTask(task),
      (async () => {
        await setTimeout(1);
        return await packageSyncerService.createTask(pkgName);
      })(),
    ]);
    assert.ok(res[1].taskId === task.taskId);
  });

  it('should append specific version to waiting task.', async () => {
    const name = '@cnpmcore/test-sync-package-has-two-versions';
    await packageSyncerService.createTask(name, {
      specificVersions: ['1.0.0'],
    });
    await packageSyncerService.createTask(name, {
      specificVersions: ['2.0.0'],
    });
    const task = await packageSyncerService.findExecuteTask();
    assert.ok(task);
    assert.equal(task.targetName, name);
    assert.ok(task.data.specificVersions);
    assert.ok(task.data.specificVersions.length === 2);
  });

  it('should remove specific version, switch waiting task to sync all versions.', async () => {
    const name = '@cnpmcore/test-sync-package-has-two-versions';
    await packageSyncerService.createTask(name, {
      specificVersions: ['1.0.0'],
    });
    await packageSyncerService.createTask(name);
    const task = await packageSyncerService.findExecuteTask();
    assert.ok(task);
    assert.equal(task.targetName, name);
    assert.ok(task.data.specificVersions === undefined);
  });

  it('should not duplicate task when waiting', async () => {
    const task = await packageSyncerService.createTask(pkgName);
    const newTask = await packageSyncerService.createTask(pkgName);
    assert.ok(newTask.taskId === task.taskId);
  });
});
