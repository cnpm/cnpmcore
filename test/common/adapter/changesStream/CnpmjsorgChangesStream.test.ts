import { CnpmjsorgChangesStream } from 'app/common/adapter/changesStream/CnpmjsorgChangesStream';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { RegistryManagerService } from 'app/core/service/RegistryManagerService';
import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';

describe('test/common/adapter/changesStream/CnpmjsorgChangesStream.test.ts', () => {
  let ctx: Context;
  let cnpmjsorgChangesStream: CnpmjsorgChangesStream;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    cnpmjsorgChangesStream = await ctx.getEggObject(CnpmjsorgChangesStream);
    registryManagerService = await ctx.getEggObject(RegistryManagerService);
    registry = await registryManagerService.createRegistry({
      name: 'cnpmcore',
      changeStream: 'https://r2.cnpmjs.org/_changes',
      host: 'https://registry.npmmirror.com',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmjsorg,
    });
  });

  describe('getInitialSince()', () => {
    it('should work', async () => {
      const since = await cnpmjsorgChangesStream.getInitialSince(registry);
      assert(since === '1');
    });

  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/r2\.cnpmjs\.org/, {
        status: 200,
        data: {
          results: [
            {
              type: 'PACKAGE_VERSION_ADDED',
              id: 'abc-cli',
              changes: [{ version: '0.0.1' }],
              gmt_modified: '2014-01-14T19:35:09.000Z',
            },
            {
              type: 'PACKAGE_TAG_ADDED',
              id: 'abc-cli',
              changes: [{ tag: 'latest' }],
              gmt_modified: '2014-01-15T19:35:09.000Z',
            },
          ],
        },
      });
      const res = await cnpmjsorgChangesStream.fetchChanges(registry, '1');
      assert(res.changes.length === 2);
      assert(res.lastSince === '1389814509000');
    });

    it('should reject when limit', async () => {
      app.mockHttpclient(/https:\/\/r2\.cnpmjs\.org/, {
        status: 200,
        data: {
          results: [
            {
              type: 'PACKAGE_VERSION_ADDED',
              id: 'abc-cli',
              changes: [{ version: '0.0.1' }],
              gmt_modified: '2014-01-14T19:35:09.000Z',
            },
            {
              type: 'PACKAGE_TAG_ADDED',
              id: 'abc-cli',
              changes: [{ tag: 'latest' }],
              gmt_modified: '2014-01-14T19:35:09.000Z',
            },
          ],
        },
      });
      await assert.rejects(cnpmjsorgChangesStream.fetchChanges(registry, '1'), /limit too large/);
    });
  });
});
