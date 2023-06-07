import { Readable, Duplex } from 'node:stream';
import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { ChangesStreamChange } from '../../../../app/common/adapter/changesStream/AbstractChangesStream';
import { NpmChangesStream } from '../../../../app/common/adapter/changesStream/NpmChangesStream';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { Registry } from '../../../../app/core/entity/Registry';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';

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
      assert(since === '9517');
    });

    it('should throw error', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, () => {
        throw new Error('mock request replicate _changes error');
      });
      await assert.rejects(npmChangesStream.getInitialSince(registry), /mock request/);
    });

    it('should throw error invalid seq', async () => {
      app.mockHttpclient(/https:\/\/replicate\.npmjs\.com/, { data: { update_seqs: 'invalid' } });
      await assert.rejects(npmChangesStream.getInitialSince(registry), /get getInitialSince failed/);
    });
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      mock(app.httpclient, 'request', async () => {
        return {
          res: Readable.from(`
          {"seq":2,"id":"backbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
          {"seq":3,"id":"backbone2.websql.deferred","changes":[{"rev":"4-f6150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
          `),
        };
      });
      const res: ChangesStreamChange[] = [];
      const stream = await npmChangesStream.fetchChanges(registry, '9517');
      for await (const change of stream) {
        res.push(change);
      }
      assert(res.length === 2);
    });

    it('should work for broken chunk', async () => {
      const rStream = Duplex.from('');
      mock(app.httpclient, 'request', async () => {
        return {
          res: rStream,
        };
      });
      const res: ChangesStreamChange[] = [];
      const stream = await npmChangesStream.fetchChanges(registry, '9517');
      assert(stream);
      rStream.push('{"seq":2');
      rStream.push(',"id":"bac');
      rStream.push('kbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true}');
      for await (const change of stream) {
        res.push(change);
      }
      assert(res.length === 1);
    });
  });
});
