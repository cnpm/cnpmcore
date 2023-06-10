import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { PlaywrightBinary } from '../../../../app/common/adapter/binary/PlaywrightBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/PlaywrightBinary.test.ts', () => {
  let binary: PlaywrightBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(PlaywrightBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/playwright-core', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/playwright-core.json'),
        persist: false,
      });
      app.mockAgent().get('https://unpkg.com')
        .intercept({
          method: 'GET',
          path: /browsers\.json/,
        })
        .reply(200, await TestUtil.readFixturesFile('unpkg.com/playwright-core-browsers.json'))
        .persist();
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      for (const item of result.items) {
        if (item.name === 'builds/') {
          assert(item.date);
          assert.equal(item.isDir, true);
          assert(item.size === '-');
          matchDir1 = true;
        }
      }
      assert(matchDir1);
    });

    it('should fetch subdir: /builds/, /builds/chromium/ work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/playwright-core', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/playwright-core.json'),
        persist: false,
      });
      app.mockAgent().get('https://unpkg.com')
        .intercept({
          method: 'GET',
          path: /browsers\.json/,
        })
        .reply(200, await TestUtil.readFixturesFile('unpkg.com/playwright-core-browsers.json'))
        .persist();
      let result = await binary.fetch('/builds/');
      assert(result);
      // console.log(result.items);
      assert.equal(result.items.length, 8);
      assert.equal(result.items[0].name, 'chromium/');
      assert.equal(result.items[1].name, 'chromium-tip-of-tree/');
      assert.equal(result.items[2].name, 'chromium-with-symbols/');
      assert.equal(result.items[3].name, 'firefox/');
      assert.equal(result.items[4].name, 'firefox-beta/');
      assert.equal(result.items[5].name, 'webkit/');
      assert.equal(result.items[6].name, 'ffmpeg/');
      assert.equal(result.items[7].name, 'android/');
      assert.equal(result.items[0].isDir, true);

      const names = [
        'chromium', 'chromium-tip-of-tree', 'chromium-with-symbols', 'firefox', 'firefox-beta',
        'webkit', 'ffmpeg',
      ];
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
