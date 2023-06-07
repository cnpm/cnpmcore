import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ChangesStreamChange } from '../../../../app/common/adapter/changesStream/AbstractChangesStream';
import { CnpmcoreChangesStream } from '../../../../app/common/adapter/changesStream/CnpmcoreChangesStream';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { Registry } from '../../../../app/core/entity/Registry';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';

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
      assert(since === '9517');
    });

    it('should throw error', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, () => {
        throw new Error('mock request replicate _changes error');
      });
      await assert.rejects(cnpmcoreChangesStream.getInitialSince(registry), /mock request/);
    });

    it('should throw error invalid seq', async () => {
      app.mockHttpclient(/https:\/\/r\.cnpmjs\.org/, { data: { update_seqs: 'invalid' } });
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

      assert(res.length === 1);
    });
  });
});
