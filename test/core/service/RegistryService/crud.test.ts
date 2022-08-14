import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { RegistryService } from 'app/core/service/RegistryService';
import { ScopeRepository } from 'app/repository/ScopeRepository';

describe('test/core/service/ChangeStreamService/executeTask.test.ts', () => {
  let ctx: Context;
  let registryService: RegistryService;
  let scopeRepository: ScopeRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    registryService = await ctx.getEggObject(RegistryService);
    scopeRepository = await ctx.getEggObject(ScopeRepository);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('registry crud()', () => {
    it('should work', async () => {

      // create
      await registryService.update({
        name: 'custom',
        changeStream: 'https://r.cnpmjs.org/_changes',
        host: 'https://cnpmjs.org',
        userPrefix: 'cnpm:',
        type: 'cnpmcore',
        scopes: [ '@cnpm', '@cnpmjs' ],
      });

      const [ registry ] = await registryService.list();

      assert(registry.name === 'custom');
      assert(registry.type === 'cnpmcore');
      assert.deepEqual(registry.scopes.map(item => item.name), [ '@cnpm', '@cnpmjs' ]);
      assert(registry.scopes[0].registryId === registry.registryId);

      // create another
      await registryService.update({
        name: 'custom2',
        changeStream: 'https://r.cnpmjs.org/_changes',
        host: 'https://cnpmjs.org',
        userPrefix: 'cnpm:',
        type: 'cnpmcore',
        scopes: [ '@dnpm', '@dnpmjs' ],
      });

      const [ _, otherRegistry ] = await registryService.list();
      assert(_);
      assert(otherRegistry.name === 'custom2');
      assert.deepEqual(otherRegistry.scopes.map(item => item.name), [ '@dnpm', '@dnpmjs' ]);
      assert(otherRegistry.scopes[0].registryId === otherRegistry.registryId);

      // update registry
      await registryService.update({
        ...registry,
        id: registry.id,
        name: 'foo',
        scopes: [],
      });

      const [ updatedRegistry ] = await registryService.list();

      assert(updatedRegistry.name === 'foo');
      assert.deepEqual(updatedRegistry.scopes, []);

      // remove registry
      await registryService.remove({ name: updatedRegistry.name });
      await registryService.remove({ registryId: otherRegistry.registryId });
      const registryList = await registryService.list();
      assert(registryList.length === 0);

      // should remove scopes too
      const scopes = await scopeRepository.listScopes();
      assert(scopes.length === 0);

    });
  });
});
