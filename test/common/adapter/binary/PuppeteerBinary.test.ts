import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PuppeteerBinary } from 'app/common/adapter/binary/PuppeteerBinary';

describe('test/common/adapter/binary/PuppeteerBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch work', async () => {
      const binary = new PuppeteerBinary(ctx.httpclient, ctx.logger);
      let result = await binary.fetch('/');
      assert(result);
      assert(result.items.length === 5);
      // 'Linux_x64', 'Mac', 'Mac_Arm', 'Win', 'Win_x64'
      assert(result.items[0].name === 'Linux_x64/');
      assert(result.items[0].isDir === true);
      assert(result.items[0].date);
      assert(result.items[1].name === 'Mac/');
      assert(result.items[1].isDir === true);
      assert(result.items[1].date);
      assert(result.items[2].name === 'Mac_Arm/');
      assert(result.items[2].isDir === true);
      assert(result.items[2].date);
      assert(result.items[3].name === 'Win/');
      assert(result.items[3].isDir === true);
      assert(result.items[3].date);
      assert(result.items[4].name === 'Win_x64/');
      assert(result.items[4].isDir === true);
      assert(result.items[4].date);

      result = await binary.fetch('/Linux_x64/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        assert(item.isDir === true);
        assert(item.date);
        if (item.name === '938248/') {
          matchDir = true;
        }
      }
      assert(matchDir);

      result = await binary.fetch('/Linux_x64/938248/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Mac/938248/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-mac.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Mac_Arm/938248/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-mac.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Win/938248/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-win.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Win_x64/938248/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-win.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
    });
  });
});
