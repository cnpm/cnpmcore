import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService';
import { Registry } from '../../../../app/core/entity/Registry';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskType } from '../../../../app/common/enum/Task';
import { ChangesStreamTaskData } from '../../../../app/core/entity/Task';

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
        assert(queryRes.count === 2);
        const [ _, registry ] = queryRes.data;
        assert(_);
        assert(registry.name === 'custom2');
      });

      it('pageOptions should work', async () => {
        // pageOptions should work
        let queryRes = await registryManagerService.listRegistries({ pageIndex: 0, pageSize: 1 });
        assert(queryRes.count === 2);
        assert(queryRes.data.length === 1);
        const [ firstRegistry ] = queryRes.data;
        assert(firstRegistry.name === 'custom');

        queryRes = await registryManagerService.listRegistries({ pageIndex: 1, pageSize: 1 });
        assert(queryRes.count === 2);
        assert(queryRes.data.length === 1);
        const [ secondRegistry ] = queryRes.data;
        assert(secondRegistry.name === 'custom2');
      });

    });

    it('update work', async () => {
      let queryRes = await registryManagerService.listRegistries({});
      const [ registry ] = queryRes.data;

      await registryManagerService.updateRegistry({
        ...registry,
        name: 'custom3',
      });

      queryRes = await registryManagerService.listRegistries({});
      assert(queryRes.data[0].name === 'custom3');

    });

    it('update should check registry', async () => {
      const queryRes = await registryManagerService.listRegistries({});
      assert(queryRes.count === 1);
      const [ registry ] = queryRes.data;
      await assert.rejects(
        registryManagerService.updateRegistry({
          ...registry,
          registryId: 'not_exist',
          name: 'boo',
        }),
        /not found/,
      );
    });

    it('remove should work', async () => {
      let queryRes = await registryManagerService.listRegistries({});
      assert(queryRes.count === 1);
      await registryManagerService.remove({ registryId: queryRes.data[0].registryId });
      queryRes = await registryManagerService.listRegistries({});
      assert(queryRes.count === 0);
    });

    describe('createSyncChangesStream()', async () => {
      let registry: Registry;
      beforeEach(async () => {
        // create scope
        [ registry ] = (await registryManagerService.listRegistries({})).data;
        await scopeManagerService.createScope({ name: '@cnpm', registryId: registry.registryId });
      });

      it('should work', async () => {
        // create success
        await registryManagerService.createSyncChangesStream({ registryId: registry.registryId });
        const targetName = 'CUSTOM_WORKER';
        const task = await taskRepository.findTaskByTargetName(targetName, TaskType.ChangesStream);
        assert(task);
        assert((task.data as ChangesStreamTaskData).registryId === registry.registryId);
      });

      it('should preCheck registry', async () => {
        await assert.rejects(registryManagerService.createSyncChangesStream({ registryId: 'mock_invalid_registry_id' }), /not found/);
      });

      it('should preCheck scopes', async () => {
        const newRegistry = await registryManagerService.createRegistry({
          name: 'custom4',
          changeStream: 'https://r.cnpmjs.org/_changes',
          host: 'https://cnpmjs.org',
          userPrefix: 'cnpm:',
          type: RegistryType.Cnpmcore,
        });
        await assert.rejects(registryManagerService.createSyncChangesStream({ registryId: newRegistry.registryId }), /please create scopes first/);
      });

      it('should create only once', async () => {
        // create success
        await registryManagerService.createSyncChangesStream({ registryId: registry.registryId });
        await registryManagerService.createSyncChangesStream({ registryId: registry.registryId });
        await registryManagerService.createSyncChangesStream({ registryId: registry.registryId, since: '100' });
        const targetName = 'CUSTOM_WORKER';
        const task = await taskRepository.findTaskByTargetName(targetName, TaskType.ChangesStream);
        assert((task?.data as ChangesStreamTaskData).since === '');
      });
    });
  });
});
