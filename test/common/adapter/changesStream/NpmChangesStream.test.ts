import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import type { ChangesStreamChange } from '../../../../app/common/adapter/changesStream/AbstractChangesStream.js';
import { NpmChangesStream } from '../../../../app/common/adapter/changesStream/NpmChangesStream.js';
import { RegistryType } from '../../../../app/common/enum/Registry.js';
import type { Registry } from '../../../../app/core/entity/Registry.js';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService.js';

describe('test/common/adapter/changesStream/NpmChangesStream.test.ts', () => {
  let npmChangesStream: NpmChangesStream;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  beforeEach(async () => {
    npmChangesStream = await app.getEggObject(NpmChangesStream);
    registryManagerService = await app.getEggObject(RegistryManagerService);
    registry = await registryManagerService.createRegistry({
      name: 'npm',
      changeStream: 'https://replicate.npmjs.com/_changes',
      host: 'https://regsitry.npmjs.org',
      userPrefix: 'npm:',
      type: RegistryType.Npm,
    });
  });

  describe('getInitialSince()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          update_seq: 9527,
        },
      });
      const since = await npmChangesStream.getInitialSince(registry);
      assert.match(since, /^\d+$/);
    });

    it('should throw error', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, () => {
        throw new Error('mock request replicate _changes error');
      });
      await assert.rejects(
        npmChangesStream.getInitialSince(registry),
        /mock request/
      );
    });

    it('should throw error invalid seq', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        data: { update_seqs: 'invalid' },
      });
      await assert.rejects(
        npmChangesStream.getInitialSince(registry),
        /get getInitialSince failed/
      );
    });
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, {
        status: 200,
        data: {
          results: [
            {
              seq: 1,
              id: 'create-react-component-helper',
              changes: [{ rev: '5-18d3f1e936474bec418e087d082af5eb' }],
            },
            {
              seq: 2,
              id: 'yj-binaryxml',
              changes: [{ rev: '89-288fe33f74d9ab42ccdcfbea2a4b16eb' }],
            },
          ],
        },
      });
      const res: ChangesStreamChange[] = [];
      const stream = npmChangesStream.fetchChanges(registry, '9517');
      for await (const change of stream) {
        res.push(change);
      }
      assert.equal(res.length, 2);
    });

    it.skip('should read changes work', async () => {
      let lastSeq = '62000870';
      for (let i = 0; i < 10_000; i++) {
        // 62080870
        // 36904024
        const stream = npmChangesStream.fetchChanges(registry, lastSeq);
        assert(stream);
        let hasMore = false;
        try {
          for await (const change of stream) {
            // oxlint-disable-next-line no-console
            console.log(i, change);
            lastSeq = change.seq;
            hasMore = true;
          }
        } catch (err) {
          // oxlint-disable-next-line no-console
          console.error(err);
        }
        if (!hasMore) {
          break;
        }
      }
    });
  });
});
