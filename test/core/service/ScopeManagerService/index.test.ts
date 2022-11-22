import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ScopeManagerService } from 'app/core/service/ScopeManagerService';

describe('test/core/service/ScopeManagerService/index.test.ts', () => {
  let ctx: Context;
  let scopeManagerService: ScopeManagerService;

  before(async () => {
    ctx = await app.mockModuleContext();
    scopeManagerService = await ctx.getEggObject(ScopeManagerService);
  });

  beforeEach(async () => {
    // create
    await scopeManagerService.createScope({
      name: 'custom',
      registryId: 'banana',
    });
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('ScopeManagerService', () => {
    it('query should work', async () => {
      const queryRes = await scopeManagerService.listScopes({});
      assert(queryRes.data[0].name === 'custom');
    });

    it('query after create work', async () => {
      // create another
      await scopeManagerService.createScope({
        name: 'custom2',
        registryId: 'banana',
      });

      const queryRes = await scopeManagerService.listScopes({});
      const [ _, otherScope ] = queryRes.data;
      assert(_);
      assert(otherScope.name === 'custom2');

    });
  });
});
