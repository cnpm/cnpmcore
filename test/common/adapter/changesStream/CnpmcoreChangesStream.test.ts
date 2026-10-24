import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import type { ChangesStreamChange } from '../../../../app/common/adapter/changesStream/AbstractChangesStream.ts';
import { CnpmcoreChangesStream } from '../../../../app/common/adapter/changesStream/CnpmcoreChangesStream.ts';
import { RegistryType } from '../../../../app/common/enum/Registry.ts';
import type { Registry } from '../../../../app/core/entity/Registry.ts';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService.ts';

describe('test/common/adapter/changesStream/CnpmcoreChangesStream.test.ts', () => {
  let cnpmcoreChangesStream: CnpmcoreChangesStream;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  beforeEach(async () => {
    cnpmcoreChangesStream = await app.getEggObject(CnpmcoreChangesStream);
    registryManagerService = await app.getEggObject(RegistryManagerService);
    registry = await registryManagerService.createRegistry({
      name: 'cnpmcore',
      changeStream: 'https://r.cnpmjs.org/_changes',
      host: 'https://registry.npmmirror.com',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmcore,
    });
  });

  describe('getInitialSince()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, {
        status: 200,
        data: {
          update_seq: 9527,
        },
      });
      const since = await cnpmcoreChangesStream.getInitialSince(registry);
      assert.ok(since === '9517');
    });

    it('should throw error', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, () => {
        throw new Error('mock request replicate _changes error');
      });
      await assert.rejects(cnpmcoreChangesStream.getInitialSince(registry), /mock request/);
    });

    it('should throw error invalid seq', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, {
        data: { update_seqs: 'invalid' },
      });
      await assert.rejects(cnpmcoreChangesStream.getInitialSince(registry), /get getInitialSince failed/);
    });
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, {
        status: 200,
        data: {
          results: [
            {
              seq: 1,
              type: 'PACKAGE_VERSION_ADDED',
              id: 'create-react-component-helper',
              changes: [{ version: '1.0.2' }],
            },
            {
              seq: 2,
              type: 'PACKAGE_VERSION_ADDED',
              id: 'yj-binaryxml',
              changes: [{ version: '1.0.0-arisa0' }],
            },
          ],
        },
      });
      const stream = cnpmcoreChangesStream.fetchChanges(registry, '1');
      const res: ChangesStreamChange[] = [];

      for await (const change of stream) {
        res.push(change as ChangesStreamChange);
      }

      assert.ok(res.length === 1);
    });

    it('should yield a cursor-only change for last_seq beyond the last result', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, {
        status: 200,
        data: {
          results: [{ seq: 1, type: 'PACKAGE_VERSION_ADDED', id: 'foo', changes: [] }],
          last_seq: 5,
        },
      });
      const res: ChangesStreamChange[] = [];
      for await (const change of cnpmcoreChangesStream.fetchChanges(registry, '1')) {
        res.push(change);
      }
      assert.deepEqual(res, [{ fullname: '', seq: '5' }]);
    });

    it('should not yield a cursor-only change when last_seq equals the last result', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, {
        status: 200,
        data: {
          results: [{ seq: 2, type: 'PACKAGE_VERSION_ADDED', id: 'foo', changes: [] }],
          last_seq: 2,
        },
      });
      const res: ChangesStreamChange[] = [];
      for await (const change of cnpmcoreChangesStream.fetchChanges(registry, '1')) {
        res.push(change);
      }
      assert.deepEqual(res, [{ fullname: 'foo', seq: '2' }]);
    });
  });
});
