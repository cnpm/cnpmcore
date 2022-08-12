import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ScopeRepository } from 'app/repository/ScopeRepository';
import { Scope } from 'app/core/entity/Scope';

describe('test/repository/ChangeRepository.test.ts', () => {
  let ctx: Context;

  let scopeRepository: ScopeRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    scopeRepository = await ctx.getEggObject(ScopeRepository);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });


  describe('RegistryRepository crud', () => {
    it('create', async () => {
      // create
      const cnpmjsScope = await scopeRepository.saveScope(Scope.create({
        name: '@cnpmjs',
        registryId: '1',
      }));

      const cnpmScope = await scopeRepository.saveScope(Scope.create({
        name: '@cnpm',
        registryId: '1',
      }));

      assert(cnpmScope);
      assert(cnpmjsScope);

      // list
      const scopes = await scopeRepository.listScopes();
      assert.deepEqual([cnpmjsScope.name, cnpmScope.name], scopes.map(scope => scope.name));

      // remove
      await scopeRepository.removeScope(cnpmjsScope.scopeId);
      const scopesAfterRemove = await scopeRepository.listScopes();
      assert.deepEqual(scopesAfterRemove.map(scope => scope.name), [cnpmScope.name]);
      await scopeRepository.removeScopeByRegistryId(cnpmjsScope.registryId);
      const empty = await scopeRepository.listScopes();
      assert.deepEqual(empty, []);
    })
  });
});
