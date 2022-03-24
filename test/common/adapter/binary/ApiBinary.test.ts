import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ApiBinary } from 'app/common/adapter/binary/ApiBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/ApiBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      const binary = new ApiBinary(ctx.httpclient, ctx.logger, binaries.node, 'https://cnpmjs.org/mirrors/apis');
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'v0.10.40/') {
          assert(item.date === '09-Jul-2015 21:57');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'node-v0.1.100.tar.gz') {
          assert(item.date === '26-Aug-2011 16:21');
          assert(item.isDir === false);
          assert(item.size === 3813493);
          assert(item.url === 'https://r.cnpmjs.org/-/binary/node/node-v0.1.100.tar.gz');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'number');
          assert(item.size > 0);
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /v16.13.1/ work', async () => {
      const binary = new ApiBinary(ctx.httpclient, ctx.logger, binaries.node, 'https://r.cnpmjs.org/-/binary');
      const result = await binary.fetch('/v16.13.1/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          assert(item.date === '30-Nov-2021 19:33');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert(item.date === '01-Dec-2021 16:13');
          assert(item.isDir === false);
          assert(item.size === 3153);
          assert(item.url === 'https://r.cnpmjs.org/-/binary/node/v16.13.1/SHASUMS256.txt');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'number');
          assert(item.size > 0);
        }
      }
      assert(matchDir);
      assert(matchFile);
    });
  });
});
