import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService.ts';

describe('test/core/service/ScopeManagerService/index.test.ts', () => {
  let scopeManagerService: ScopeManagerService;

  before(async () => {
    scopeManagerService = await app.getEggObject(ScopeManagerService);
  });

  beforeEach(async () => {
    // create
    await scopeManagerService.createScope({
      name: 'custom',
      registryId: 'banana',
    });
  });

  describe('ScopeManagerService', () => {
    it('query should work', async () => {
      const queryRes = await scopeManagerService.listScopes({});
      assert.ok(queryRes.data[0].name === 'custom');
    });

    it('query after create work', async () => {
      // create another
      await scopeManagerService.createScope({
        name: 'custom2',
        registryId: 'banana',
      });

      const queryRes = await scopeManagerService.listScopes({});
      const [_, otherScope] = queryRes.data;
      assert.ok(_);
      assert.ok(otherScope.name === 'custom2');
    });
  });
});
