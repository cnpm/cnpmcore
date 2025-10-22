import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../test/TestUtil.ts';
import { HookManageService } from '../../../app/core/service/HookManageService.ts';
import { HookType } from '../../../app/common/enum/Hook.ts';
import { UserRepository } from '../../../app/repository/UserRepository.ts';
import { PACKAGE_VERSION_ADDED } from '../../../app/core/event/index.ts';
import { Change } from '../../../app/core/entity/Change.ts';
import { ChangeRepository } from '../../../app/repository/ChangeRepository.ts';
import { Task } from '../../../app/core/entity/Task.ts';
import { HookEvent } from '../../../app/core/entity/HookEvent.ts';
import { CreateHookTriggerService } from '../../../app/core/service/CreateHookTriggerService.ts';
import { TaskRepository } from '../../../app/repository/TaskRepository.ts';
import type { Hook } from '../../../app/core/entity/Hook.ts';

describe('test/core/service/CreateHookTriggerService.test.ts', () => {
  let hookManageService: HookManageService;
  let changeRepository: ChangeRepository;
  let createHookTriggerService: CreateHookTriggerService;
  let taskRepository: TaskRepository;
  const pkgName = '@cnpmcore/foo';
  const username = 'mock_username';
  let userId: string;

  beforeEach(async () => {
    hookManageService = await app.getEggObject(HookManageService);
    changeRepository = await app.getEggObject(ChangeRepository);
    createHookTriggerService = await app.getEggObject(CreateHookTriggerService);
    taskRepository = await app.getEggObject(TaskRepository);
    const userRepository = await app.getEggObject(UserRepository);
    await TestUtil.createPackage(
      {
        name: pkgName,
      },
      {
        name: username,
      }
    );
    const user = await userRepository.findUserByName(username);
    assert.ok(user);
    userId = user.userId;
  });

  describe('executeTask', () => {
    let change: Change;
    beforeEach(async () => {
      change = Change.create({
        type: PACKAGE_VERSION_ADDED,
        targetName: pkgName,
        data: {
          version: '1.0.0',
        },
      });
      await changeRepository.addChange(change);
    });

    describe('package hook', () => {
      let hook: Hook;
      beforeEach(async () => {
        hook = await hookManageService.createHook({
          type: HookType.Package,
          ownerId: userId,
          name: pkgName,
          endpoint: 'http://foo.com',
          secret: 'mock_secret',
        });
      });

      it('should create package hook trigger', async () => {
        const task = Task.createCreateHookTask(
          HookEvent.createUnpublishEvent(pkgName, change.changeId)
        );
        await createHookTriggerService.executeTask(task);
        const pushTask = await taskRepository.findTaskByBizId(
          `TriggerHook:${change.changeId}:${hook.hookId}`
        );
        assert.ok(pushTask);
      });
    });

    describe('scope hook', () => {
      let hook: Hook;
      beforeEach(async () => {
        hook = await hookManageService.createHook({
          type: HookType.Scope,
          ownerId: userId,
          name: '@cnpmcore',
          endpoint: 'http://foo.com',
          secret: 'mock_secret',
        });
      });

      it('should create scope hook trigger', async () => {
        const task = Task.createCreateHookTask(
          HookEvent.createUnpublishEvent(pkgName, change.changeId)
        );
        await createHookTriggerService.executeTask(task);
        const pushTask = await taskRepository.findTaskByBizId(
          `TriggerHook:${change.changeId}:${hook.hookId}`
        );
        assert.ok(pushTask);
      });
    });

    describe('owner hook', () => {
      let hook: Hook;
      beforeEach(async () => {
        hook = await hookManageService.createHook({
          type: HookType.Owner,
          ownerId: userId,
          name: username,
          endpoint: 'http://foo.com',
          secret: 'mock_secret',
        });
      });

      it('should create scope hook trigger', async () => {
        const task = Task.createCreateHookTask(
          HookEvent.createUnpublishEvent(pkgName, change.changeId)
        );
        await createHookTriggerService.executeTask(task);
        const pushTask = await taskRepository.findTaskByBizId(
          `TriggerHook:${change.changeId}:${hook.hookId}`
        );
        assert.ok(pushTask);
      });
    });
  });
});
