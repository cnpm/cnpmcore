import assert = require('assert');
import { readFile } from 'fs/promises';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PlaywrightBinary } from 'app/common/adapter/binary/PlaywrightBinary';
import binaries from 'config/binaries';
import { TestUtil } from 'test/TestUtil';

describe('test/common/adapter/binary/PlaywrightBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/playwright-core', 'GET', {
        data: await readFile(TestUtil.getFixtures('playwright-core.json')),
        persist: false,
      });
      app.mockAgent().get('https://unpkg.com')
        .intercept({
          method: 'GET',
          path: /browsers\.json/,
        })
        .reply(200, await readFile(TestUtil.getFixtures('playwright-core-browsers.json')))
        .persist();
      const binary = new PlaywrightBinary(ctx.httpclient, ctx.logger, binaries.playwright);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      for (const item of result.items) {
        if (item.name === 'builds/') {
          assert(item.date);
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
      }
      assert(matchDir1);
    });

    it('should fetch subdir: /builds/, /builds/chromium/ work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/playwright-core', 'GET', {
        data: await readFile(TestUtil.getFixtures('playwright-core.json')),
        persist: false,
      });
      app.mockAgent().get('https://unpkg.com')
        .intercept({
          method: 'GET',
          path: /browsers\.json/,
        })
        .reply(200, await readFile(TestUtil.getFixtures('playwright-core-browsers.json')))
        .persist();
      const binary = new PlaywrightBinary(ctx.httpclient, ctx.logger, binaries.playwright);
      let result = await binary.fetch('/builds/');
      assert(result);
      // console.log(result.items);
      assert(result.items.length === 7);
      assert(result.items[0].name === 'chromium/');
      assert(result.items[1].name === 'chromium-tip-of-tree/');
      assert(result.items[2].name === 'chromium-with-symbols/');
      assert(result.items[3].name === 'firefox/');
      assert(result.items[4].name === 'firefox-beta/');
      assert(result.items[5].name === 'webkit/');
      assert(result.items[6].name === 'ffmpeg/');
      assert(result.items[0].isDir);

      const names = [ 'chromium', 'chromium-tip-of-tree', 'chromium-with-symbols', 'firefox', 'firefox-beta', 'webkit', 'ffmpeg' ];
      for (const dirname of names) {
        result = await binary.fetch(`/builds/${dirname}/`);
        assert(result);
        // console.log(dirname, result.items);
        assert(result.items.length > 0);
        for (const item of result.items) {
          assert(item.isDir);
        }
        result = await binary.fetch(`/builds/${dirname}/${result.items[0].name}`);
        assert(result);
        // console.log(result.items);
        assert(result.items.length > 0);
        for (const item of result.items) {
          // {
          //   name: 'chromium-linux.zip',
          //   isDir: false,
          //   url: 'https://playwright.azureedge.net/builds/chromium/1000/chromium-linux.zip',
          //   size: '-',
          //   date: '2022-04-18T20:51:53.788Z'
          // },
          assert(item.isDir === false);
          assert(item.name);
          assert(item.size === '-');
          assert(item.url);
          assert(item.date);
        }
      }
    });
  });
});
