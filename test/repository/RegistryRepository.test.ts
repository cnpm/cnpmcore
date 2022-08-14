import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { RegistryRepository } from 'app/repository/RegistryRepository';
import { Registry } from 'app/core/entity/Registry';
import { RegistryType } from 'app/common/enum/registry';

describe('test/repository/ChangeRepository.test.ts', () => {
  let ctx: Context;

  let registryRepository: RegistryRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    registryRepository = await ctx.getEggObject(RegistryRepository);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });


  describe('RegistryRepository crud', () => {
    it('create', async () => {
      // create
      const registryModel = await registryRepository.saveRegistry(Registry.create({
        name: 'cnpmcore',
        userPrefix: 'cnpm:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore' as RegistryType,
      }));

      assert(registryModel);
      assert(registryModel.type === 'cnpmcore');

      // update
      const updatedRegistry = await registryRepository.saveRegistry(Registry.create({
        id: registryModel.id,
        name: 'banana',
        userPrefix: 'cnpm:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore' as RegistryType,
      }));
      assert(updatedRegistry);
      assert(updatedRegistry.name === 'banana');

      // find
      const registry = await registryRepository.findRegistry('banana');
      assert(registry);
      assert(registry.registryId === updatedRegistry.registryId);

      const changeStreamRegistry = await registryRepository.findRegistryByChangeStream('https://replicate.npmjs.com/_changes');
      assert.deepEqual(registry, changeStreamRegistry);

      // list
      const registries = await registryRepository.listRegistries();
      assert.deepEqual([ registry ], registries);

      // remove
      await registryRepository.removeRegistry(registry.registryId);
      const empty = await registryRepository.listRegistries();
      assert.deepEqual(empty, []);
    });
  });
});
