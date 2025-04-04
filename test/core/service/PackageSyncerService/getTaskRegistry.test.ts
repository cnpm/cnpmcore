import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService.js';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService.js';
import type { Registry } from '../../../../app/core/entity/Registry.js';
import { RegistryType } from '../../../../app/common/enum/Registry.js';
import type { Task } from '../../../../app/core/entity/Task.js';

describe('test/core/service/PackageSyncerService/getTaskRegistry.test.ts', () => {
  let packageSyncerService: PackageSyncerService;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  let task: Task;

  beforeEach(async () => {
    packageSyncerService = await app.getEggObject(PackageSyncerService);
    registryManagerService = await app.getEggObject(RegistryManagerService);
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

  describe('getTaskRegistry()', () => {
    it('should work', async () => {
      const taskRegistry = await packageSyncerService.initSpecRegistry(
        task,
        null,
        '@cnpm'
      );
      assert.equal(taskRegistry.registryId, registry.registryId);
    });
    it('should support legacy task', async () => {
      const task = await packageSyncerService.createTask('@cnpm/bananas', {
        authorIp: '123',
        authorId: 'ChangesStreamService',
        skipDependencies: true,
        tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: 1`,
      });

      const taskRegistry = await packageSyncerService.initSpecRegistry(
        task,
        null,
        '@cnpm'
      );
      assert.equal(taskRegistry.name, 'default');
    });
  });
});
