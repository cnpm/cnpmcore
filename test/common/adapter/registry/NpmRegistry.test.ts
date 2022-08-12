import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import * as fs from 'fs';
import { Context } from 'egg';
import { RegistryService } from 'app/core/service/RegistryService';
import { NpmRegistry } from 'app/common/adapter/registry/NpmRegistry';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { TestUtil } from 'test/TestUtil';


describe('test/common/adapter/registry/NpmRegistry.test.ts', () => {
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
        name: 'npm',
        scopes: [],
        userPrefix: 'npm:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'npm',
      });
      const [ registry ] = await registryService.list();
      const adapter = new NpmRegistry(ctx.httpclient, ctx.logger, registry);

      app.mockHttpclient(/.*/g, 'GET', {
        data: {
          results: [],
        },
        status: 200,
      });
      const { since, status } = await adapter.fetch('1');
      assert(since === '1');
      assert(status === 200);

      const res = await adapter.fetch('10000');
      assert(res.since === '10000');
    });
  });

  // TODO mock stream
  describe.skip('handleChanges()', () => {
    it('should sync all packages', async () => {
      await registryService.update({
        name: 'npm',
        scopes: [],
        userPrefix: 'npm:',
        changeStream: 'https://replicate.npmjs.com/_changes',
        host: 'https://registry.npmjs.org',
        type: 'npm',
      });
      const [ registry ] = await registryService.list();
      const adapter = new NpmRegistry(ctx.httpclient, ctx.logger, registry);

      const dataPath = TestUtil.getFixtures('npm-changes.json')
      const data = await TestUtil.readJSONFile(dataPath);
      app.mockHttpclient(/https:\/\/replicate.npmjs.com\/_changes/, () => {
        return fs.createReadStream(dataPath) as any;
      });
      const { taskData, syncCount, taskCount, lastSince } = await adapter.handleChanges('10000', {}, packageSyncerService);
      assert(syncCount === data.length);
      assert(taskCount === data.length);
      assert(lastSince === '10000');
      assert((taskData as any).last_package, data.results[data.results.length - 1].id);

    });
  });
});
