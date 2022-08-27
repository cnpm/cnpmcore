import { ChangesStreamChange } from 'app/common/adapter/changesStream/AbstractChangesStream';
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
      const now = new Date().getTime();
      assert(now - Number(since) < 10000);
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
      const stream = await cnpmjsorgChangesStream.fetchChanges(registry, '1');
      const res: ChangesStreamChange[] = [];
      for await (const change of stream) {
        res.push(change as ChangesStreamChange);
      }
      assert(res.length === 2);
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
      const stream = await cnpmjsorgChangesStream.fetchChanges(registry, '1');
      await assert.rejects(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of stream) {
          // ...
        }
      }, /limit too large/);
    });
  });
});
