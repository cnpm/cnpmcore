import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { Sqlite3Binary } from 'app/common/adapter/binary/Sqlite3Binary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/Sqlite3Binary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      const binary = new Sqlite3Binary(ctx.httpclient, ctx.logger, binaries.sqlite3);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v2.2.6/') {
          assert(item.date === '2014-08-06T19:01:15.869Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v5.0.2/') {
          assert(item.date === '2021-02-15T21:08:36.117Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);
    });

    it('should fetch subdir: /v2.2.6/, /v5.0.2/ work', async () => {
      const binary = new Sqlite3Binary(ctx.httpclient, ctx.logger, binaries.sqlite3);
      let result = await binary.fetch('/v2.2.6/');
      assert(result);
      assert(result.items.length >= 6);
      for (const item of result.items) {
        assert(!item.isDir);
        assert(item.name.endsWith('-x64.tar.gz'));
        assert(item.name.startsWith('node-v'));
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404, 403 ]);
      }

      result = await binary.fetch('/v5.0.2/');
      assert(result);
      assert(result.items.length === 3);
      assert(result.items[0].isDir === false);
      assert(result.items[0].name === 'napi-v3-linux-x64.tar.gz');
      assert(result.items[1].isDir === false);
      assert(result.items[1].name === 'napi-v3-darwin-x64.tar.gz');
      assert(result.items[2].isDir === false);
      assert(result.items[2].name === 'napi-v3-win32-x64.tar.gz');
      assert.deepEqual(result.items[2].ignoreDownloadStatuses, [ 404, 403 ]);
    });
  });
});
