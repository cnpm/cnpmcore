import assert from 'assert';
import { Readable } from 'node:stream';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../test/TestUtil';
import { ChangesStreamService } from '../../../app/core/service/ChangesStreamService';
import { TaskService } from '../../../app/core/service/TaskService';
import { ChangesStreamTask, Task } from '../../../app/core/entity/Task';
import { RegistryManagerService } from '../../../app/core/service/RegistryManagerService';
import { RegistryType } from '../../../app/common/enum/Registry';
import { ScopeManagerService } from '../../../app/core/service/ScopeManagerService';
import { Registry } from '../../../app/core/entity/Registry';
import { RedisQueueAdapter } from '../../../app/infra/QueueAdapter';

describe('test/core/service/ChangesStreamService.test.ts', () => {
  let changesStreamService: ChangesStreamService;
  let scopeManagerService: ScopeManagerService;
  let registryManagerService: RegistryManagerService;
  let taskService: TaskService;
  let task: ChangesStreamTask;
  let npmRegistry: Registry;
  let cnpmRegistry: Registry;
  let queueAdapter: RedisQueueAdapter;
  beforeEach(async () => {
    changesStreamService = await app.getEggObject(ChangesStreamService);
    taskService = await app.getEggObject(TaskService);
    registryManagerService = await app.getEggObject(RegistryManagerService);
    scopeManagerService = await app.getEggObject(ScopeManagerService);
    queueAdapter = await app.getEggObject(RedisQueueAdapter);
    assert(changesStreamService);
    task = Task.createChangesStream('GLOBAL_WORKER', '', '9527');
    taskService.createTask(task, false);

    // create default registry
    await registryManagerService.createRegistry({
      name: 'npm',
      changeStream: 'https://replicate.npmjs.com/_changes',
      host: 'https://regsitry.npmjs.org',
      userPrefix: 'npm:',
      type: RegistryType.Npm,
    });

    // create custom registry
    await registryManagerService.createRegistry({
      name: 'cnpm',
      changeStream: 'https://r.cnpmjs.org',
      host: 'https://r.npmjs.org',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmcore,
    });

    const data = (await registryManagerService.listRegistries({})).data;
    npmRegistry = data[0];
    cnpmRegistry = data[1];

    // create custom scope
    await scopeManagerService.createScope({
      name: '@cnpm',
      registryId: cnpmRegistry.registryId,
    });
  });

  describe('prepareRegistry()', () => {
    it('should init since', async () => {
      assert(task.data.since === '9527');
    });
    it('should create default registry by config', async () => {
      await changesStreamService.prepareRegistry(task);
      let registries = await registryManagerService.listRegistries({});
      assert(registries.count === 3);

      // only create once
      await changesStreamService.prepareRegistry(task);
      registries = await registryManagerService.listRegistries({});
      assert(registries.count === 3);
    });

    it('should throw error when invalid registryId', async () => {
      await changesStreamService.prepareRegistry(task);
      const registries = await registryManagerService.listRegistries({});
      assert(registries.count === 3);

      // remove the registry
      const registryId = task.data.registryId;
      assert(registryId);
      await registryManagerService.remove({ registryId });

      await assert.rejects(changesStreamService.prepareRegistry(task), /invalid change stream registry/);
    });
  });

  describe('needSync()', () => {
    it('follow ', async () => {
      await TestUtil.createPackage({
        name: '@cnpm/test',
        isPrivate: false,
        registryId: npmRegistry.registryId,
      });
      const res = await changesStreamService.needSync(npmRegistry, '@cnpm/test');
      assert(res);
    });

    it('unscoped package should sync default registry', async () => {
      const res = await changesStreamService.needSync(npmRegistry, 'banana');
      assert(res);
    });

    it('scoped package should sync default registry', async () => {
      const res = await changesStreamService.needSync(npmRegistry, '@gogogo/banana');
      assert(res);
    });

    it('scoped package should sync custom registry', async () => {
      let res = await changesStreamService.needSync(cnpmRegistry, '@cnpm/banana');
      assert(res);
      res = await changesStreamService.needSync(cnpmRegistry, '@dnpmjs/banana');
      assert(!res);
    });

    it('unscoped package should not sync custom registry', async () => {
      const res = await changesStreamService.needSync(cnpmRegistry, 'banana');
      assert(!res);
    });

    it('the package does not exist should not sync with any registry', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      await TestUtil.createPackage({
        name: '@cnpm/test',
        isPrivate: false,
        registryId: npmRegistry.registryId,
      });
      let res = await changesStreamService.needSync(npmRegistry, 'banana');
      assert(!res);
      res = await changesStreamService.needSync(npmRegistry, '@cnpm/test');
      assert(res);
    });
  });

  describe('getInitialSince()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          update_seq: 9527,
        },
      });
      const since = await changesStreamService.getInitialSince(task);
      assert(since === '9517');
    });
  });

  describe('getInitialSince()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          update_seq: 9527,
        },
      });
      const since = await changesStreamService.getInitialSince(task);
      assert(since === '9517');
    });
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      mock(app.httpclient, 'request', async () => {
        return {
          res: Readable.from(`
            {"seq":2,"id":"backbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
            {"seq":3,"id":"backbone2.websql.deferred","changes":[{"rev":"4-f6150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
            `),
        };
      });
      const changes = await changesStreamService.executeSync('1', task);
      assert(changes.taskCount === 2);
      assert(changes.lastSince === '3');
    });

    it('should update since even not taskCount', async () => {
      mock(ChangesStreamService.prototype, 'needSync', async () => {
        return false;
      });
      mock(app.httpclient, 'request', async () => {
        return {
          res: Readable.from(`
            {"seq":2,"id":"backbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
            {"seq":3,"id":"backbone2.websql.deferred","changes":[{"rev":"4-f6150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
            `),
        };
      });
      const changes = await changesStreamService.executeSync('1', task);
      assert(changes.taskCount === 0);
      assert(changes.lastSince === '3');
      assert(task.data.since === '3');
    });
  });

  describe('suspendSync()', () => {
    beforeEach(async () => {
      app.mockLog();
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      app.mockHttpclient('https://replicate.npmjs.com/_changes?since=9527', 'GET', () => {
        return {
          data: {
            res: Readable.from(''),
          },
        };
      });
    });
    it('should work', async () => {
      const task = await changesStreamService.findExecuteTask();
      assert(task);
      await changesStreamService.executeTask(task);
      assert(task.state === 'processing');

      let len = await queueAdapter.length('changes_stream');
      assert(len === 0);
      await changesStreamService.suspendSync(true);
      const newTask = await taskService.findTask(task.taskId);
      assert(newTask);
      assert(newTask.taskId === task.taskId);
      assert(newTask.state === 'waiting');
      len = await queueAdapter.length('changes_stream');
      assert(len === 1);

      app.expectLog('[ChangesStreamService.suspendSync:suspend] taskId');

    });

    it('should suspendSync when error', async () => {
      mock(app.config.cnpmcore, 'enableChangesStream', true);

      const task = await changesStreamService.findExecuteTask();
      assert(task);
      mock(changesStreamService, 'executeSync', async () => {
        throw new Error('mock error');
      });
      await changesStreamService.executeTask(task);

      const newTask = await taskService.findTask(task.taskId);
      assert(newTask);
      assert(newTask.state === 'waiting');
      // still sync nexttick;
      assert(app.config.cnpmcore.enableChangesStream === true);
      const len = await queueAdapter.length('changes_stream');
      assert(len === 1);
      app.expectLog('[ChangesStreamService.suspendSync:start]');
      app.expectLog('[ChangesStreamService.suspendSync:suspend] taskId');
    });

    it('should ignore when changesStream disable', async () => {
      mock(app.config.cnpmcore, 'enableChangesStream', false);
      await changesStreamService.suspendSync(true);
      app.expectLog('[ChangesStreamService.suspendSync:finish]');
    });

  });
});
