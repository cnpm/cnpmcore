import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { RegistryManagerService } from 'app/core/service/RegistryManagerService';
import { Registry } from 'app/core/entity/Registry';
import { RegistryType } from 'app/common/enum/Registry';
import { Task } from 'app/core/entity/Task';

describe('test/core/service/PackageSyncerService/getTaskRegistry.test.ts', () => {
  let ctx: Context;
  let packageSyncerService: PackageSyncerService;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  let task: Task;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
    registryManagerService = await ctx.getEggObject(RegistryManagerService);
    registry = await registryManagerService.createRegistry({
      name: 'cnpmcore',
      changeStream: 'https://r.cnpmjs.org/_changes',
      host: 'https://registry.npmmirror.com',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmcore,
    });

    task = await packageSyncerService.createTask('@cnpm/banana', {
      authorIp: '123',
      authorId: 'ChangesStreamService',
      registryId: registry.registryId,
      skipDependencies: true,
      tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: 1`,
    });

  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('getTaskRegistry()', () => {
    it('should work', async () => {
      const taskRegistry = await packageSyncerService.prepareRegistryHost(task);
      assert(taskRegistry);
      assert(taskRegistry.registryId === registry.registryId);
    });
    it('should support legacy task', async () => {
      const task = await packageSyncerService.createTask('@cnpm/bananas', {
        authorIp: '123',
        authorId: 'ChangesStreamService',
        skipDependencies: true,
        tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: 1`,
      });

      const taskRegistry = await packageSyncerService.prepareRegistryHost(task);
      assert(taskRegistry === null);
    })
  });
});
