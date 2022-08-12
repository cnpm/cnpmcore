import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ChangesStreamService } from 'app/core/service/ChangesStreamService';
import { TestUtil } from 'test/TestUtil';
import { RegistryService } from 'app/core/service/RegistryService';

describe('test/core/service/ChangeStreamService/executeTask.test.ts', () => {
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

  describe('executeTask()', () => {
    it('should work', async () => {

      mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://registry.npmmirror.com/');
      mock(app.config.cnpmcore, 'changesStreamRegistryMode', 'json');
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      const task = await changeStreamService.findExecuteTask();
      assert(task);

      const data = await TestUtil.readJSONFile(TestUtil.getFixtures('npm-changes.json'));
      let retryCount = 1;
      app.mockHttpclient(/^https:\/\/registry/, () => {
        if (retryCount) {
          retryCount --
          return {
            data,
            status: 200,
          };
        }
        return {
          data: { results: [] },
          status: 200,
        };
      });
      await changeStreamService.executeTask(task);

      const taskData = task.data.find(item => item.name === 'cnpmcore').data;

      // haven't sync any package
      assert(taskData.since === '1');

    });

    it('should save reason when error', async () => {

      mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://replicate.npmjs.com');
      mock(app.config.cnpmcore, 'changesStreamRegistryMode', 'streaming');
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      const task = await changeStreamService.findExecuteTask();
      assert(task);

      app.mockHttpclient(/^https:\/\/replicate\.npmjs\.com/, 'GET', () => {
        throw new Error('mock request error');
      });
      await changeStreamService.executeTask(task);

      assert(task.data[0].error === 'Error: mock request error');

    });

    it('should support multiple registries', async () => {

      mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://replicate.npmjs.com');
      mock(app.config.cnpmcore, 'changesStreamRegistryMode', 'json');
      mock(app.config.cnpmcore, 'enableChangesStream', true);
      const task = await changeStreamService.findExecuteTask();
      assert(task);

      const data = await TestUtil.readJSONFile(TestUtil.getFixtures('cnpmcore-changes.json'));
      let retryCount = 2;
      app.mockHttpclient(/^https:\/\/r\.cnpmjs\.org/, () => {
        if (retryCount) {
          retryCount --
          return {
            data,
            status: 200,
          };
        }
        return {
          data: { results: [] },
          status: 200,
        };
      });

      const customData = await TestUtil.readJSONFile(TestUtil.getFixtures('custom-changes.json'));
      let npmRetry = 2
      app.mockHttpclient(/^https:\/\/replicate\.npmjs\.com/, () => {
        if (npmRetry) {
          npmRetry --
          return {
            data: customData,
            status: 200,
          };
        }
        return {
          data: { results: [] },
          status: 200,
        };
      });

      await registryService.update({
        name: 'custom',
        changeStream: 'https://r.cnpmjs.org/_changes',
        host: 'https://cnpmjs.org',
        userPrefix: 'cnpm:',
        type: 'cnpmcore',
        scopes: ['@cnpm', '@cnpmjs'],
      });

      await changeStreamService.executeTask(task);
      const taskData = task.data;
      assert(taskData.length === 2);
      assert(taskData[0].name === 'cnpmcore');
      assert(taskData[1].name === 'custom');

    });
  });
});
