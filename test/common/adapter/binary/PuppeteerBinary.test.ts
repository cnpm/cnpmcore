import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PuppeteerBinary } from 'app/common/adapter/binary/PuppeteerBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/PuppeteerBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch work', async () => {
      const binary = new PuppeteerBinary(ctx.httpclient, ctx.logger, binaries['chromium-browser-snapshots']);
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
      // console.log(result.items);
      let matchDir = false;
      for (const item of result.items) {
        assert(item.isDir === true);
        assert(item.date);
        if (item.name === '756035/') {
          matchDir = true;
        }
      }
      assert(matchDir);

      result = await binary.fetch('/Linux_x64/756035/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Mac/756035/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-mac.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Mac_Arm/756035/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-mac.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Win/756035/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-win.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
      result = await binary.fetch('/Win_x64/756035/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-win.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/856583/');
      assert(result);
      assert(result.items.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/869685/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/884014/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/901912/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/848005/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/843427/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/818858/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);

      result = await binary.fetch('/Linux_x64/809590/');
      assert(result);
      assert(result.items?.length === 1);
      // console.log(result.items);
      assert(result.items[0].name === 'chrome-linux.zip');
      assert(result.items[0].isDir === false);
      assert(result.items[0].date);
      assert(result.items[0].url);
    });
  });
});
