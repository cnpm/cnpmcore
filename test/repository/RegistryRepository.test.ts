import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { RegistryRepository } from '../../app/repository/RegistryRepository.ts';
import { Registry } from '../../app/core/entity/Registry.ts';
import type { RegistryType } from '../../app/common/enum/Registry.ts';

describe('test/repository/RegistryRepository.test.ts', () => {
  let registryRepository: RegistryRepository;
  let registryModel: Registry;

  beforeEach(async () => {
    registryRepository = await app.getEggObject(RegistryRepository);
    registryModel = (await registryRepository.saveRegistry(
      Registry.create({
        name: 'cnpmcore',
        userPrefix: 'cnpm:',
        changeStream: 'https://r.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore' as RegistryType,
        authToken: '',
      })
    )) as Registry;
  });

  describe('RegistryRepository', () => {
    it('create work', async () => {
      const newRegistry = (await registryRepository.saveRegistry(
        Registry.create({
          name: 'npm',
          userPrefix: 'npm:',
          changeStream: 'https://ra.npmjs.com/_changes',
          host: 'https://registry.npmjs.org',
          type: 'cnpmcore' as RegistryType,
          authToken: '',
        })
      )) as Registry;
      assert.ok(newRegistry);
      assert.ok(newRegistry.type === 'cnpmcore');
    });
    it('update work', async () => {
      const updatedRegistry = await registryRepository.saveRegistry({
        ...registryModel,
        registryId: registryModel.registryId,
        id: registryModel.id,
        name: 'banana',
        userPrefix: 'cnpm:',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore' as RegistryType,
        changeStream: 'https://replicate.npmjs.com/_changes',
      });
      assert.ok(updatedRegistry);
      assert.ok(updatedRegistry.name === 'banana');
    });
    it('list work', async () => {
      const registries = await registryRepository.listRegistries({});
      assert.ok(registries.count === 1);
    });

    it('query null', async () => {
      const queryRes = await registryRepository.findRegistry('orange');
      assert.ok(queryRes === null);
    });

    it('query work', async () => {
      const queryRes = await registryRepository.findRegistry('cnpmcore');
      assert.ok(queryRes?.name === 'cnpmcore');
    });
    it('remove work', async () => {
      await registryRepository.removeRegistry(registryModel.registryId);
      const emptyRes = await registryRepository.listRegistries({});
      assert.deepEqual(Array.from(emptyRes.data), []);
    });
  });
});
