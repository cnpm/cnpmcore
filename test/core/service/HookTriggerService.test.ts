import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';
import type { HttpClientRequestOptions } from 'egg';

import { HookType } from '../../../app/common/enum/Hook.ts';
import { Change } from '../../../app/core/entity/Change.ts';
import type { Hook } from '../../../app/core/entity/Hook.ts';
import { HookEvent } from '../../../app/core/entity/HookEvent.ts';
import { Task, type TriggerHookTask } from '../../../app/core/entity/Task.ts';
import { PACKAGE_TAG_ADDED, PACKAGE_VERSION_ADDED } from '../../../app/core/event/index.ts';
import { CreateHookTriggerService } from '../../../app/core/service/CreateHookTriggerService.ts';
import { HookManageService } from '../../../app/core/service/HookManageService.ts';
import { HookTriggerService } from '../../../app/core/service/HookTriggerService.ts';
import { ChangeRepository } from '../../../app/repository/ChangeRepository.ts';
import { TaskRepository } from '../../../app/repository/TaskRepository.ts';
import { UserRepository } from '../../../app/repository/UserRepository.ts';
import { TestUtil } from '../../../test/TestUtil.ts';

describe('test/core/service/HookTriggerService.test.ts', () => {
  let hookManageService: HookManageService;
  let changeRepository: ChangeRepository;
  let createHookTriggerService: CreateHookTriggerService;
  let taskRepository: TaskRepository;
  let hookTriggerService: HookTriggerService;
  const pkgName = '@cnpmcore/foo';
  const username = 'mock_username';
  let userId: string;

  beforeEach(async () => {
    hookManageService = await app.getEggObject(HookManageService);
    changeRepository = await app.getEggObject(ChangeRepository);
    createHookTriggerService = await app.getEggObject(CreateHookTriggerService);
    taskRepository = await app.getEggObject(TaskRepository);
    const userRepository = await app.getEggObject(UserRepository);
    hookTriggerService = await app.getEggObject(HookTriggerService);
    await TestUtil.createPackage(
      {
        name: pkgName,
      },
      {
        name: username,
      },
    );
    const user = await userRepository.findUserByName(username);
    assert.ok(user);
    userId = user.userId;
  });

  describe('executeTask', () => {
    let versionChange: Change;
    let tagChange: Change;
    let hook: Hook;
    let callEndpoint: string;
    let callOptions: HttpClientRequestOptions;

    beforeEach(async () => {
      versionChange = Change.create({
        type: PACKAGE_TAG_ADDED,
        targetName: pkgName,
        data: {
          tag: 'latest',
        },
      });
      tagChange = Change.create({
        type: PACKAGE_VERSION_ADDED,
        targetName: pkgName,
        data: {
          version: '1.0.0',
        },
      });
      await Promise.all([changeRepository.addChange(versionChange), changeRepository.addChange(tagChange)]);

      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: pkgName,
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
      const versionTask = Task.createCreateHookTask(
        HookEvent.createPublishEvent(pkgName, versionChange.changeId, '1.0.0', 'latest'),
      );
      const tagTask = Task.createCreateHookTask(
        HookEvent.createPublishEvent(pkgName, tagChange.changeId, '1.0.0', 'latest'),
      );

      await Promise.all([
        createHookTriggerService.executeTask(versionTask),
        createHookTriggerService.executeTask(tagTask),
      ]);

      mock(app.httpclient, 'request', async (url: string, options: HttpClientRequestOptions) => {
        callEndpoint = url;
        callOptions = options;
        return {
          status: 200,
        };
      });
    });

    it('should execute trigger', async () => {
      const pushTask = (await taskRepository.findTaskByBizId(
        `TriggerHook:${versionChange.changeId}:${hook.hookId}`,
      )) as TriggerHookTask;
      await hookTriggerService.executeTask(pushTask);
      assert.ok(callEndpoint === hook.endpoint);
      assert.ok(callOptions);
      assert.ok(callOptions.method === 'POST');
      assert.ok(callOptions.headers);
      assert.ok(callOptions.headers['x-npm-signature']);
      const data = JSON.parse(callOptions.data);
      assert.ok(data.event === 'package:publish');
      assert.ok(data.name === pkgName);
      assert.ok(data.type === 'package');
      assert.ok(data.version === '1.0.0');
      assert.deepStrictEqual(data.hookOwner, {
        username,
      });
      assert.ok(data.payload);
      assert.deepStrictEqual(data.change, {
        version: '1.0.0',
        'dist-tag': 'latest',
      });
      assert.ok(data.time === pushTask.data.hookEvent.time);
    });

    it('should create each event', async () => {
      const tasks = await Promise.all([
        taskRepository.findTaskByBizId(`TriggerHook:${versionChange.changeId}:${hook.hookId}`),
        taskRepository.findTaskByBizId(`TriggerHook:${tagChange.changeId}:${hook.hookId}`),
      ]);
      assert.equal(tasks.filter(Boolean).length, 2);
    });
  });
});
