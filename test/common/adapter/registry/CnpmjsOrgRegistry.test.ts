import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { RegistryService } from 'app/core/service/RegistryService';
import { CnpmjsOrgRegistry } from 'app/common/adapter/registry/CnpmjsOrgRegistry';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { TestUtil } from 'test/TestUtil';


describe('test/common/adapter/registry/CnpmjsOrgRegistry.test.ts', () => {
  let ctx: Context;
  let registryService: RegistryService;
  let packageSyncerService: PackageSyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    registryService = await ctx.getEggObject(RegistryService);
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch success', async () => {
      await registryService.update({
        name: 'cnpmjsorg',
        scopes: ['@cnpmjs', '@cnpm'],
        userPrefix: 'cnpmjs:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore',
      });
      const [ registry ] = await registryService.list();
      const adapter = new CnpmjsOrgRegistry(ctx.httpclient, ctx.logger, registry);

      app.mockHttpclient(/.*/g, 'GET', {
        data: {
          results: [],
        },
        status: 200,
      });
      const { since, status } = await adapter.fetch();
      assert(since === '1');
      assert(status === 200);

      const res = await adapter.fetch('10000');
      assert(res.since === '10000');
    });
  });

  describe('handleChanges()', () => {
    it('should sync all packages', async () => {
      await registryService.update({
        name: 'cnpmjsorg',
        scopes: ['@cnpmjs', '@cnpm'],
        userPrefix: 'cnpmjs:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'cnpmcore',
      });
      const [registry] = await registryService.list();
      const adapter = new CnpmjsOrgRegistry(ctx.httpclient, ctx.logger, registry);

      const data = await TestUtil.readJSONFile(TestUtil.getFixtures('cnpmjsorg-changes.json'));
      app.mockHttpclient(/https:\/\/replicate.npmjs.com\/_changes/, 'GET', {
        data,
        status: 200,
      });
      const { taskData, syncCount, taskCount, lastSince } = await adapter.handleChanges('10000', {}, packageSyncerService);
      assert(syncCount === 3);
      assert(taskCount === data.results.length);
      assert(lastSince === (new Date(data.results[data.results.length - 1].gmt_modified).getTime()) + '');
      assert((taskData as any).last_package, data.results[data.results.length - 1].id);

    });
  });
});
