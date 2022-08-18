import { Readable } from 'node:stream';
import { ChangesStreamChange } from 'app/common/adapter/changesStream/AbstractChangesStream';
import { NpmChangesStream } from 'app/common/adapter/changesStream/NpmChangesStream';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { RegistryManagerService } from 'app/core/service/RegistryManagerService';
import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/common/adapter/changesStream/NpmChangesStream.test.ts', () => {
  let ctx: Context;
  let npmChangesStream: NpmChangesStream;
  let registryManagerService: RegistryManagerService;
  let registry: Registry;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    npmChangesStream = await ctx.getEggObject(NpmChangesStream);
    registryManagerService = await ctx.getEggObject(RegistryManagerService);
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
  });

  describe('fetchChanges()', () => {
    it('should work', async () => {
      mock(ctx.httpclient, 'request', async () => {
        return {
          res: Readable.from(JSON.stringify([
            {
              seq: 2,
              id: 'backbone.websql.deferred',
              changes: [{ rev: '4-f5150b238ab62cd890211fb57fc9eca5' }],
              deleted: true,
            },
            {
              seq: 3,
              id: 'binomal-hash-list',
              changes: [{ rev: '2-dced04d62bef47954eac61c217ed6fc1' }],
              deleted: true,
            },
          ])),
        };
      });
      const res: ChangesStreamChange[] = [];
      const stream = await npmChangesStream.fetchChanges(registry, '9517');
      for await (const change of stream) {
        res.push(change);
      }
      assert(res.length === 2);
    });
  });

});
