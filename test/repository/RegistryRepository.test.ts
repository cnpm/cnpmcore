import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { RegistryRepository } from '../../app/repository/RegistryRepository';
import { Registry } from '../../app/core/entity/Registry';
import { RegistryType } from '../../app/common/enum/Registry';

describe('test/repository/RegistryRepository.test.ts', () => {
  let registryRepository: RegistryRepository;
  let registryModel: Registry;

  beforeEach(async () => {
    registryRepository = await app.getEggObject(RegistryRepository);
    registryModel = await registryRepository.saveRegistry(Registry.create({
      name: 'cnpmcore',
      userPrefix: 'cnpm:',
      changeStream: 'https://r.npmjs.com/_changes',
      host: 'https://registry.npmjs.org',
      type: 'cnpmcore' as RegistryType,
    })) as Registry;
  });

  describe('RegistryRepository', () => {
    it('create work', async () => {
      const newRegistry = await registryRepository.saveRegistry(Registry.create({
        name: 'npm',
        userPrefix: 'npm:',
        changeStream: 'https://ra.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore' as RegistryType,
      })) as Registry;
      assert(newRegistry);
      assert(newRegistry.type === 'cnpmcore');
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
      assert(updatedRegistry);
      assert(updatedRegistry.name === 'banana');
    });
    it('list work', async () => {
      const registries = await registryRepository.listRegistries({});
      assert(registries.count === 1);
    });

    it('query null', async () => {
      const queryRes = await registryRepository.findRegistry('orange');
      assert(queryRes === null);
    });

    it('query work', async () => {
      const queryRes = await registryRepository.findRegistry('cnpmcore');
      assert(queryRes?.name === 'cnpmcore');
    });
    it('remove work', async () => {
      await registryRepository.removeRegistry(registryModel.registryId);
      const emptyRes = await registryRepository.listRegistries({});
      assert.deepEqual(emptyRes.data, []);
    });
  });
});
