import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ChangesStreamChange } from '../../../../app/common/adapter/changesStream/AbstractChangesStream';
import { CnpmjsorgChangesStream } from '../../../../app/common/adapter/changesStream/CnpmjsorgChangesStream';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { Registry } from '../../../../app/core/entity/Registry';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';

describe('test/common/adapter/changesStream/CnpmjsorgChangesStream.test.ts', () => {
  let cnpmjsorgChangesStream: CnpmjsorgChangesStream;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  beforeEach(async () => {
    cnpmjsorgChangesStream = await app.getEggObject(CnpmjsorgChangesStream);
    registryManagerService = await app.getEggObject(RegistryManagerService);
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

    it('should work when fetch latest changes', async () => {
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
      const stream = cnpmjsorgChangesStream.fetchChanges(registry, '1');
      const changes:ChangesStreamChange[] = [];
      for await (const change of stream) {
        changes.push(change);
      }
      assert(changes.length === 2);
    });

    it('should reject max limit', async () => {
      app.mockHttpclient('https://r2.cnpmjs.org/_changes?since=1&limit=', 'GET', (url = '') => {
        const limit = (new URL(url)).searchParams.get('limit');
        return {
          data: {
            results: new Array(Number(limit)).fill(0).map((_, i) => ({
              type: 'PACKAGE_TAG_ADDED',
              id: `abc-cli-${i}`,
              changes: [{ tag: 'latest' }],
              gmt_modified: '2014-01-15T19:35:09.000Z',
            })),
          },
        };
      });
      const stream = cnpmjsorgChangesStream.fetchChanges(registry, '1');
      await assert.rejects(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of stream) {
          // ...
        }
      }, /limit too large/);
    });
  });
});
