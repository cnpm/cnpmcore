import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { AbstractRegistry } from 'app/common/adapter/registry/AbstractRegistry';
import { RegistryService } from 'app/core/service/RegistryService';


describe('test/common/adapter/registry/AbstractRegistry.test.ts', () => {
  let ctx: Context;
  let registryService: RegistryService;
  let Adapter: any;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    registryService = await ctx.getEggObject(RegistryService);
    Adapter = class Adapter extends AbstractRegistry {
      constructor() {
        super({} as any, {} as any, {} as any);
      }
      async fetch() { return {} as any}
      async handleChanges() { return {} as any}
    };
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('needSync()', () => {
    it('should sync for empty scopes', async () => {
      await registryService.update({
        name: 'npm',
        scopes: [],
        userPrefix: 'npm:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'npm',
      });
      const [ registry ] = await registryService.list();

      const adapter = new Adapter();
      assert(adapter.needSync(registry.scopes, '@cnpm/test'));
      assert(adapter.needSync(registry.scopes, 'test'));
    });

    it('should sync for specify scope', async () => {
      await registryService.update({
        name: 'cnpm',
        scopes: ['@cnpm', '@dnpm'],
        userPrefix: 'cnpm:',
        changeStream: 'https://replicate.cnpmjs.com/_changes',
        host: 'https://registry.cnpmjs.org',
        type: 'cnpmcore',
      });
      const [ registry ] = await registryService.list();

      const adapter = new Adapter();
      assert(adapter.needSync(registry.scopes, '@dnpm/test'));
      assert(adapter.needSync(registry.scopes, '@cnpm/test'));
      assert(adapter.needSync(registry.scopes, 'test') === false);
    });

    it('should ignore for other scope', async () => {
      await registryService.update({
        name: 'cnpm',
        scopes: ['@cnpm', '@dnpm'],
        userPrefix: 'cnpm:',
        changeStream: 'https://replicate.cnpmjs.com/_changes',
        host: 'https://registry.cnpmjs.org',
        type: 'cnpmcore',
      });
      const [registry] = await registryService.list();

      const adapter = new Adapter();
      assert(adapter.needSync(registry.scopes, '@enpm/banana') === false );
      assert(adapter.needSync(registry.scopes, 'test') === false );

    });

  });
});
