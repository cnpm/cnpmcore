import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { SqlcipherBinary } from 'app/common/adapter/binary/SqlcipherBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/SqlcipherBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      const binary = new SqlcipherBinary(ctx.httpclient, ctx.logger, binaries['@journeyapps/sqlcipher']);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v5.3.1/') {
          assert(item.date === '2021-12-14T13:12:31.587Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v5.0.0/') {
          assert(item.date === '2020-09-25T13:05:17.722Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);
    });

    it('should fetch subdir: /v5.3.1/ work', async () => {
      const binary = new SqlcipherBinary(ctx.httpclient, ctx.logger, binaries['@journeyapps/sqlcipher']);
      const result = await binary.fetch('/v5.3.1/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name.endsWith('.tar.gz'));
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404, 403 ]);
      }
    });
  });
});
