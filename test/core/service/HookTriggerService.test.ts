import assert from 'assert';
import { HttpClientRequestOptions } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../test/TestUtil';
import { HookManageService } from '../../../app/core/service/HookManageService';
import { HookType } from '../../../app/common/enum/Hook';
import { UserRepository } from '../../../app/repository/UserRepository';
import { PACKAGE_VERSION_ADDED } from '../../../app/core/event';
import { Change } from '../../../app/core/entity/Change';
import { ChangeRepository } from '../../../app/repository/ChangeRepository';
import { Task, TriggerHookTask } from '../../../app/core/entity/Task';
import { HookEvent } from '../../../app/core/entity/HookEvent';
import { CreateHookTriggerService } from '../../../app/core/service/CreateHookTriggerService';
import { TaskRepository } from '../../../app/repository/TaskRepository';
import { Hook } from '../../../app/core/entity/Hook';
import { HookTriggerService } from '../../../app/core/service/HookTriggerService';

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
    await TestUtil.createPackage({
      name: pkgName,
    }, {
      name: username,
    });
    const user = await userRepository.findUserByName(username);
    userId = user!.userId;
  });

  describe('executeTask', () => {
    let change: Change;
    let hook: Hook;
    let callEndpoint: string;
    let callOptions: HttpClientRequestOptions;

    beforeEach(async () => {
      change = Change.create({
        type: PACKAGE_VERSION_ADDED,
        targetName: pkgName,
        data: {
          version: '1.0.0',
        },
      });
      await changeRepository.addChange(change);
      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: pkgName,
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
      const task = Task.createCreateHookTask(HookEvent.createPublishEvent(pkgName, change.changeId, '1.0.0', 'latest'));
      await createHookTriggerService.executeTask(task);

      mock(app.httpclient, 'request', async (url, options) => {
        callEndpoint = url;
        callOptions = options;
        return {
          status: 200,
        };
      });
    });

    it('should execute trigger', async () => {
      const pushTask = await taskRepository.findTaskByBizId(`TriggerHook:${change.changeId}:${hook.hookId}`) as TriggerHookTask;
      await hookTriggerService.executeTask(pushTask);
      assert(callEndpoint === hook.endpoint);
      assert(callOptions);
      assert(callOptions.method === 'POST');
      assert(callOptions.headers!['x-npm-signature']);
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
  });
});
