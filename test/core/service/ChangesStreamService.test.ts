import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../test/TestUtil.ts';
import { ChangesStreamService } from '../../../app/core/service/ChangesStreamService.ts';
import { TaskService } from '../../../app/core/service/TaskService.ts';
import { Task, type ChangesStreamTask } from '../../../app/core/entity/Task.ts';
import { RegistryManagerService } from '../../../app/core/service/RegistryManagerService.ts';
import { RegistryType } from '../../../app/common/enum/Registry.ts';
import { ScopeManagerService } from '../../../app/core/service/ScopeManagerService.ts';
import type { Registry } from '../../../app/core/entity/Registry.ts';
import { RedisQueueAdapter } from '../../../app/infra/QueueAdapter.ts';

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
    assert.ok(changesStreamService);
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

    const queryRes = await registryManagerService.listRegistries({});
    npmRegistry = queryRes.data[0];
    cnpmRegistry = queryRes.data[1];

    // create custom scope
    await scopeManagerService.createScope({
      name: '@cnpm',
      registryId: cnpmRegistry.registryId,
    });
  });

  describe('prepareRegistry()', () => {
    it('should init since', async () => {
      assert.ok(task.data.since === '9527');
    });
    it('should create default registry by config', async () => {
      await changesStreamService.prepareRegistry(task);
      let registries = await registryManagerService.listRegistries({});
      assert.ok(registries.count === 3);

      // only create once
      await changesStreamService.prepareRegistry(task);
      registries = await registryManagerService.listRegistries({});
      assert.ok(registries.count === 3);
    });

    it('should throw error when invalid registryId', async () => {
      await changesStreamService.prepareRegistry(task);
      const registries = await registryManagerService.listRegistries({});
      assert.ok(registries.count === 3);

      // remove the registry
      const registryId = task.data.registryId;
      assert.ok(registryId);
      await registryManagerService.remove({ registryId });

      await assert.rejects(
        changesStreamService.prepareRegistry(task),
        /invalid change stream registry/
      );
    });
  });

  describe('needSync()', () => {
    it('follow ', async () => {
      await TestUtil.createPackage({
        name: '@cnpm/test',
        isPrivate: false,
        registryId: npmRegistry.registryId,
      });
      const res = await changesStreamService.needSync(
        npmRegistry,
        '@cnpm/test'
      );
      assert.ok(res);
    });

    it('unscoped package should sync default registry', async () => {
      const res = await changesStreamService.needSync(npmRegistry, 'banana');
      assert.ok(res);
    });

    it('scoped package should sync default registry', async () => {
      const res = await changesStreamService.needSync(
        npmRegistry,
        '@gogogo/banana'
      );
      assert.ok(res);
    });

    it('scoped package should sync custom registry', async () => {
      let res = await changesStreamService.needSync(
        cnpmRegistry,
        '@cnpm/banana'
      );
      assert.ok(res);
      res = await changesStreamService.needSync(cnpmRegistry, '@dnpmjs/banana');
      assert.ok(!res);
    });

    it('unscoped package should not sync custom registry', async () => {
      const res = await changesStreamService.needSync(cnpmRegistry, 'banana');
      assert.ok(!res);
    });

    it('the package does not exist should not sync with any registry', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      await TestUtil.createPackage({
        name: '@cnpm/test',
        isPrivate: false,
        registryId: npmRegistry.registryId,
      });
      let res = await changesStreamService.needSync(npmRegistry, 'banana');
      assert.ok(!res);
      res = await changesStreamService.needSync(npmRegistry, '@cnpm/test');
      assert.ok(res);
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
      assert.ok(since === '9517');
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
      assert.ok(since === '9517');
    });
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          results: [
            {
              seq: 2,
              id: 'create-react-component-helper',
              changes: [{ rev: '5-18d3f1e936474bec418e087d082af5eb' }],
            },
            {
              seq: 3,
              id: 'yj-binaryxml',
              changes: [{ rev: '89-288fe33f74d9ab42ccdcfbea2a4b16eb' }],
            },
          ],
        },
      });
      const changes = await changesStreamService.executeSync('1', task);
      assert.equal(changes.taskCount, 2, JSON.stringify(changes));
      assert.equal(changes.lastSince, '3');
    });

    it('should update since even not taskCount', async () => {
      mock(ChangesStreamService.prototype, 'needSync', async () => {
        return false;
      });
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          results: [
            {
              seq: 2,
              id: 'create-react-component-helper',
              changes: [{ rev: '5-18d3f1e936474bec418e087d082af5eb' }],
            },
            {
              seq: 3,
              id: 'yj-binaryxml',
              changes: [{ rev: '89-288fe33f74d9ab42ccdcfbea2a4b16eb' }],
            },
          ],
        },
      });
      const changes = await changesStreamService.executeSync('1', task);
      assert.equal(changes.taskCount, 0);
      assert.equal(changes.lastSince, '3');
      assert.equal(task.data.since, '3');
    });
  });

  describe('suspendSync()', () => {
    beforeEach(async () => {
      app.mockLog();
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      app.mockHttpclient(
        'https://replicate.npmjs.com/registry/_changes?since=9527',
        'GET',
        () => {
          return {
            data: {
              res: Readable.from(''),
            },
          };
        }
      );
    });
    it('should work', async () => {
      const task = await changesStreamService.findExecuteTask();
      assert.ok(task);
      await changesStreamService.executeTask(task);
      assert.ok(task.state === 'processing');

      let len = await queueAdapter.length('changes_stream');
      assert.ok(len === 0);
      await changesStreamService.suspendSync(true);
      const newTask = await taskService.findTask(task.taskId);
      assert.ok(newTask);
      assert.ok(newTask.taskId === task.taskId);
      assert.ok(newTask.state === 'waiting');
      len = await queueAdapter.length('changes_stream');
      assert.ok(len === 1);

      app.expectLog('[ChangesStreamService.suspendSync:suspend] taskId');
    });

    it('should suspendSync when error', async () => {
      mock(app.config.cnpmcore, 'enableChangesStream', true);

      const task = await changesStreamService.findExecuteTask();
      assert.ok(task);
      mock(changesStreamService, 'executeSync', async () => {
        throw new Error('mock error');
      });
      await changesStreamService.executeTask(task);

      const newTask = await taskService.findTask(task.taskId);
      assert.ok(newTask);
      assert.ok(newTask.state === 'waiting');
      // still sync nexttick;
      assert.ok(app.config.cnpmcore.enableChangesStream === true);
      const len = await queueAdapter.length('changes_stream');
      assert.ok(len === 1);
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
