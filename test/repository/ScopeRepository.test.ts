import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ScopeRepository } from '../../app/repository/ScopeRepository';
import { Scope } from '../../app/core/entity/Scope';

describe('test/repository/ScopeRepository.test.ts', () => {
  let scopeRepository: ScopeRepository;
  let cnpmjsScope: Scope;

  beforeEach(async () => {
    scopeRepository = await app.getEggObject(ScopeRepository);
    cnpmjsScope = await scopeRepository.saveScope(Scope.create({
      name: '@cnpmjs',
      registryId: '1',
    })) as Scope;
  });

  describe('RegistryRepository', () => {
    it('create work', async () => {
      const cnpmScope = await scopeRepository.saveScope(Scope.create({
        name: '@cnpm',
        registryId: '1',
      }));
      assert(cnpmScope);
      assert(cnpmjsScope);
    });

    it('list work', async () => {
      // list
      const cnpmScope = await scopeRepository.saveScope(Scope.create({
        name: '@cnpm',
        registryId: '1',
      })) as Scope;
      const scopeRes = await scopeRepository.listScopes({});
      assert.deepEqual([ cnpmjsScope.name, cnpmScope.name ], scopeRes.data.map(scope => scope.name));
    });

    it('update work', async () => {
      await scopeRepository.saveScope({
        ...cnpmjsScope,
        id: cnpmjsScope.id,
        scopeId: cnpmjsScope.scopeId,
        name: '@anpm',
        registryId: '1',
      });
      const scopeRes = await scopeRepository.listScopes({});
      assert(scopeRes.count === 1);
      assert(scopeRes.data[0].name === '@anpm');
    });

    it('remove work', async () => {
      // remove
      const cnpmScope = await scopeRepository.saveScope(Scope.create({
        name: '@cnpm',
        registryId: '1',
      })) as Scope;
      await scopeRepository.removeScope(cnpmjsScope.scopeId);
      const scopesAfterRemove = await scopeRepository.listScopes({});
      assert.deepEqual(scopesAfterRemove.data.map(scope => scope.name), [ cnpmScope.name ]);
      await scopeRepository.removeScopeByRegistryId(cnpmjsScope.registryId);
      const emptyRes = await scopeRepository.listScopes({});
      assert.deepEqual(emptyRes.data, []);
    });
  });
});
