import assert from 'node:assert/strict';
import type { HttpClientRequestOptions } from 'egg';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../test/TestUtil.js';
import { HookManageService } from '../../../app/core/service/HookManageService.js';
import { HookType } from '../../../app/common/enum/Hook.js';
import { UserRepository } from '../../../app/repository/UserRepository.js';
import {
  PACKAGE_TAG_ADDED,
  PACKAGE_VERSION_ADDED,
} from '../../../app/core/event/index.js';
import { Change } from '../../../app/core/entity/Change.js';
import { ChangeRepository } from '../../../app/repository/ChangeRepository.js';
import { Task, type TriggerHookTask } from '../../../app/core/entity/Task.js';
import { HookEvent } from '../../../app/core/entity/HookEvent.js';
import { CreateHookTriggerService } from '../../../app/core/service/CreateHookTriggerService.js';
import { TaskRepository } from '../../../app/repository/TaskRepository.js';
import type { Hook } from '../../../app/core/entity/Hook.js';
import { HookTriggerService } from '../../../app/core/service/HookTriggerService.js';

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
      }
    );
    const user = await userRepository.findUserByName(username);
    assert(user);
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
      await Promise.all([
        changeRepository.addChange(versionChange),
        changeRepository.addChange(tagChange),
      ]);

      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: pkgName,
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
      const versionTask = Task.createCreateHookTask(
        HookEvent.createPublishEvent(
          pkgName,
          versionChange.changeId,
          '1.0.0',
          'latest'
        )
      );
      const tagTask = Task.createCreateHookTask(
        HookEvent.createPublishEvent(
          pkgName,
          tagChange.changeId,
          '1.0.0',
          'latest'
        )
      );

      await Promise.all([
        createHookTriggerService.executeTask(versionTask),
        createHookTriggerService.executeTask(tagTask),
      ]);

      mock(
        app.httpclient,
        'request',
        async (url: string, options: HttpClientRequestOptions) => {
          callEndpoint = url;
          callOptions = options;
          return {
            status: 200,
          };
        }
      );
    });

    it('should execute trigger', async () => {
      const pushTask = (await taskRepository.findTaskByBizId(
        `TriggerHook:${versionChange.changeId}:${hook.hookId}`
      )) as TriggerHookTask;
      await hookTriggerService.executeTask(pushTask);
      assert(callEndpoint === hook.endpoint);
      assert(callOptions);
      assert(callOptions.method === 'POST');
      assert(callOptions.headers);
      assert(callOptions.headers['x-npm-signature']);
      const data = JSON.parse(callOptions.data);
      assert(data.event === 'package:publish');
      assert(data.name === pkgName);
      assert(data.type === 'package');
      assert(data.version === '1.0.0');
      assert.deepStrictEqual(data.hookOwner, {
        username,
      });
      assert(data.payload);
      assert.deepStrictEqual(data.change, {
        version: '1.0.0',
        'dist-tag': 'latest',
      });
      assert(data.time === pushTask.data.hookEvent.time);
    });

    it('should create each event', async () => {
      const tasks = await Promise.all([
        taskRepository.findTaskByBizId(
          `TriggerHook:${versionChange.changeId}:${hook.hookId}`
        ),
        taskRepository.findTaskByBizId(
          `TriggerHook:${tagChange.changeId}:${hook.hookId}`
        ),
      ]);
      assert.equal(tasks.filter(Boolean).length, 2);
    });
  });
});
