import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { BucketBinary } from 'app/common/adapter/binary/BucketBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/BucketBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      const binary = new BucketBinary(ctx.httpclient, ctx.logger, binaries.chromedriver);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === '97.0.4692.71/') {
          assert(item.date === '-');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'LATEST_RELEASE_70.0.3538') {
          assert(item.date === '2018-11-06T07:19:08.413Z');
          assert(item.size === 12);
          assert(item.url === 'https://chromedriver.storage.googleapis.com/LATEST_RELEASE_70.0.3538');
          matchFile = true;
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /97.0.4692.71/ work', async () => {
      const binary = new BucketBinary(ctx.httpclient, ctx.logger, binaries.chromedriver);
      const result = await binary.fetch('/97.0.4692.71/');
      assert(result);
      assert(result.items.length > 0);
      let matchFile = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(typeof item.size === 'number');
        assert(item.size > 2);
        // console.log(item);
        if (item.name === 'chromedriver_mac64_m1.zip') {
          assert(item.date === '2022-01-05T05:45:15.397Z');
          assert(item.size === 7846919);
          assert(item.url === 'https://chromedriver.storage.googleapis.com/97.0.4692.71/chromedriver_mac64_m1.zip');
          matchFile = true;
        }
      }
      assert(matchFile);
    });

    it('should ignore dir with size = 0', async () => {
      // https://selenium-release.storage.googleapis.com/?delimiter=/&prefix=2.43/
      const binary = new BucketBinary(ctx.httpclient, ctx.logger, binaries.selenium);
      const result = await binary.fetch('/2.43/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name !== '2.43');
      }
    });

    it('should ignore AWSLogs/', async () => {
      const binary = new BucketBinary(ctx.httpclient, ctx.logger, binaries['node-inspector']);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name !== 'AWSLogs/');
      }
    });

    it('should ignore build_testruns/', async () => {
      const binary = new BucketBinary(ctx.httpclient, ctx.logger, binaries.prisma);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name !== 'build_testruns/');
      }
    });
  });
});
