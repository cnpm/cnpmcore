import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { NodePreGypBinary } from 'app/common/adapter/binary/NodePreGypBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/NodePreGypBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch grpc', async () => {
      const binary = new NodePreGypBinary(ctx.httpclient, ctx.logger, binaries.grpc);
      let result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.24.11/') {
          assert(item.date === '2021-07-23T18:07:10.297Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v1.14.0/') {
          assert(item.date === '2018-08-10T16:59:52.551Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);

      result = await binary.fetch('/v1.24.11/');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name);
        assert(item.date);
        assert(item.url);
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
      }
    });

    it('should fetch grpc-tools', async () => {
      const binary = new NodePreGypBinary(ctx.httpclient, ctx.logger, binaries['grpc-tools']);
      let result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.11.2/') {
          assert(item.date === '2021-06-18T17:01:49.917Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v0.14.1/') {
          assert(item.date === '2016-05-11T22:54:25.492Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);

      result = await binary.fetch('/v1.11.2/');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name);
        assert(item.date);
        assert(item.url);
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
      }
    });
  });
});
