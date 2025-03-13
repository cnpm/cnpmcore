import { strict as assert } from 'node:assert';
import { app } from '@eggjs/mock/bootstrap';

import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService.js';
import { RegistryType } from '../../../../app/common/enum/Registry.js';
import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService.js';
import type { Registry } from '../../../../app/core/entity/Registry.js';
import { TaskRepository } from '../../../../app/repository/TaskRepository.js';
import { TaskType } from '../../../../app/common/enum/Task.js';
import type { ChangesStreamTaskData } from '../../../../app/core/entity/Task.js';

describe('test/core/service/RegistryManagerService/index.test.ts', () => {
  let registryManagerService: RegistryManagerService;
  let scopeManagerService: ScopeManagerService;
  let taskRepository: TaskRepository;

  before(async () => {
    registryManagerService = await app.getEggObject(RegistryManagerService);
    scopeManagerService = await app.getEggObject(ScopeManagerService);
    taskRepository = await app.getEggObject(TaskRepository);
  });

  beforeEach(async () => {
    // create Registry
    await registryManagerService.createRegistry({
      name: 'custom',
      changeStream: 'https://r.cnpmjs.org/_changes',
      host: 'https://cnpmjs.org',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmcore,
    });
  });

  describe('RegistryManagerService', () => {
    describe('query should work', async () => {
      beforeEach(async () => {
        // create another
        await registryManagerService.createRegistry({
          name: 'custom2',
          changeStream: 'https://r.cnpmjs.org/_changes',
          host: 'https://cnpmjs.org',
          userPrefix: 'ccnpm:',
          type: RegistryType.Cnpmcore,
        });
      });

      it('query success', async () => {
        // query success
        const queryRes = await registryManagerService.listRegistries({});
        assert.equal(queryRes.count, 2);
        const [_, registry] = queryRes.data;
        assert(_);
        assert.equal(registry.name, 'custom2');
      });

      it('pageOptions should work', async () => {
        // pageOptions should work
        let queryRes = await registryManagerService.listRegistries({
          pageIndex: 0,
          pageSize: 1,
        });
        assert.equal(queryRes.count, 2);
        assert.equal(queryRes.data.length, 1);
        const [firstRegistry] = queryRes.data;
        assert.equal(firstRegistry.name, 'custom');

        queryRes = await registryManagerService.listRegistries({
          pageIndex: 1,
          pageSize: 1,
        });
        assert.equal(queryRes.count, 2);
        assert.equal(queryRes.data.length, 1);
        const [secondRegistry] = queryRes.data;
        assert.equal(secondRegistry.name, 'custom2');
      });
    });

    it('update work', async () => {
      let queryRes = await registryManagerService.listRegistries({});
      const [registry] = queryRes.data;

      await registryManagerService.updateRegistry(registry.registryId, {
        ...registry,
        name: 'custom3',
      });

      queryRes = await registryManagerService.listRegistries({});
      assert.equal(queryRes.data[0].name, 'custom3');
    });

    it('update should check registry', async () => {
      const queryRes = await registryManagerService.listRegistries({});
      assert.equal(queryRes.count, 1);
      const [registry] = queryRes.data;
      await assert.rejects(
        registryManagerService.updateRegistry('not_exist', {
          ...registry,
          name: 'boo',
        }),
        /not found/
      );
    });

    it('remove should work', async () => {
      let queryRes = await registryManagerService.listRegistries({});
      assert.equal(queryRes.count, 1);
      await registryManagerService.remove({
        registryId: queryRes.data[0].registryId,
      });
      queryRes = await registryManagerService.listRegistries({});
      assert.equal(queryRes.count, 0);
    });

    describe('createSyncChangesStream()', async () => {
      let registry: Registry;
      beforeEach(async () => {
        // create scope
        [registry] = (await registryManagerService.listRegistries({})).data;
        await scopeManagerService.createScope({
          name: '@cnpm',
          registryId: registry.registryId,
        });
      });

      it('should work', async () => {
        // create success
        await registryManagerService.createSyncChangesStream({
          registryId: registry.registryId,
        });
        const targetName = 'CUSTOM_WORKER';
        const task = await taskRepository.findTaskByTargetName(
          targetName,
          TaskType.ChangesStream
        );
        assert(task);
        assert.equal(
          (task.data as ChangesStreamTaskData).registryId,
          registry.registryId
        );
      });

      it('should preCheck registry', async () => {
        await assert.rejects(
          registryManagerService.createSyncChangesStream({
            registryId: 'mock_invalid_registry_id',
          }),
          /not found/
        );
      });

      it('should preCheck scopes', async () => {
        const newRegistry = await registryManagerService.createRegistry({
          name: 'custom4',
          changeStream: 'https://r.cnpmjs.org/_changes',
          host: 'https://cnpmjs.org',
          userPrefix: 'cnpm:',
          type: RegistryType.Cnpmcore,
        });
        await assert.rejects(
          registryManagerService.createSyncChangesStream({
            registryId: newRegistry.registryId,
          }),
          /please create scopes first/
        );
      });

      it('should create only once', async () => {
        // create success
        await registryManagerService.createSyncChangesStream({
          registryId: registry.registryId,
        });
        await registryManagerService.createSyncChangesStream({
          registryId: registry.registryId,
        });
        // won't create new task
        await registryManagerService.createSyncChangesStream({
          registryId: registry.registryId,
          since: '100',
        });
        const targetName = 'CUSTOM_WORKER';
        const task = await taskRepository.findTaskByTargetName(
          targetName,
          TaskType.ChangesStream
        );
        assert(task);
        assert.equal((task.data as ChangesStreamTaskData).since, '');
      });
    });
  });
});
