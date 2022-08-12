import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ChangesStreamService } from 'app/core/service/ChangesStreamService';
import { RegistryService } from 'app/core/service/RegistryService';
import { RegistryType } from 'app/common/enum/registry';

describe('test/core/service/ChangeStreamService/convertLegacyChangeStream.test.ts', () => {
  let ctx: Context;
  let changeStreamService: ChangesStreamService;
  let registryService: RegistryService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    changeStreamService = await ctx.getEggObject(ChangesStreamService);
    registryService = await ctx.getEggObject(RegistryService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('convertLegacyChangeStream()', () => {
    it('should init registries', async () => {

      mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://replicate.npmjs.com');
      mock(app.config.cnpmcore, 'changesStreamRegistryMode', 'streaming');
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      const task = await changeStreamService.findExecuteTask();
      assert(task);
      assert(task.targetName === 'GLOBAL_WORKER');
      assert(task.data.since === '');

      // convert changesStream config to registry
      await changeStreamService.convertLegacyChangeStream(task);
      const [ registry ] = await registryService.list();

      assert(registry.type === RegistryType.Npm);
      assert(registry.scopes.length === 0);
      assert(registry.name === 'npm');

      assert(task.data.length === 1);
      assert(task.data[0].name === 'npm');
      assert(task.data[0].data.since === '');

      // do noting
      await changeStreamService.convertLegacyChangeStream(task);
      const registries = await registryService.list();
      assert(registries.length === 1);

    });
  });
});
