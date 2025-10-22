import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { PuppeteerBinary } from '../../../../app/common/adapter/binary/PuppeteerBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/PuppeteerBinary.test.ts', () => {
  let binary: PuppeteerBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(PuppeteerBinary);
  });
  describe('fetch()', () => {
    it('should fetch work', async () => {
      app.mockHttpclient(
        'https://chromium-browser-snapshots.storage.googleapis.com',
        url => {
          if (url.includes('1441468')) {
            return {
              data: TestUtil.readFixturesFileSync(
                'chromium-browser-snapshots.storage.googleapis.com/Linux.xml'
              ),
            };
          }
          return {
            data: TestUtil.readFixturesFileSync(
              'chromium-browser-snapshots.storage.googleapis.com/Linux_end.xml'
            ),
          };
        }
      );

      let result = await binary.fetch('/', 'chromium-browser-snapshots', {
        Linux_x64: '1441468',
        Mac: '1441468',
        Mac_Arm: '1441468',
        Win: '1441468',
        Win_x64: '1441468',
      });
      assert.ok(result);
      assert.ok(result.items.length === 5);
      // 'Linux_x64', 'Mac', 'Mac_Arm', 'Win', 'Win_x64'
      assert.ok(result.items[0].name === 'Linux_x64/');
      assert.ok(result.items[0].isDir === true);
      assert.ok(result.items[0].date);
      assert.ok(result.items[1].name === 'Mac/');
      assert.ok(result.items[1].isDir === true);
      assert.ok(result.items[1].date);
      assert.ok(result.items[2].name === 'Mac_Arm/');
      assert.ok(result.items[2].isDir === true);
      assert.ok(result.items[2].date);
      assert.ok(result.items[3].name === 'Win/');
      assert.ok(result.items[3].isDir === true);
      assert.ok(result.items[3].date);
      assert.ok(result.items[4].name === 'Win_x64/');
      assert.ok(result.items[4].isDir === true);
      assert.ok(result.items[4].date);

      result = await binary.fetch('/Linux_x64/', 'chromium-browser-snapshots');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(result.items);
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        assert.ok(item.date);
        if (item.name === '1000015/') {
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch(
        '/Linux_x64/1000015/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);
      result = await binary.fetch(
        '/Mac/1000015/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-mac.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);
      result = await binary.fetch(
        '/Mac_Arm/1000015/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-mac.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);
      result = await binary.fetch(
        '/Win/1000015/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-win.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);
      result = await binary.fetch(
        '/Win_x64/1000015/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-win.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);

      result = await binary.fetch(
        '/Linux_x64/100057/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);

      result = await binary.fetch(
        '/Linux_x64/1000569/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items?.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);

      result = await binary.fetch(
        '/Linux_x64/100056/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items?.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);

      result = await binary.fetch(
        '/Linux_x64/1000557/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items?.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);

      result = await binary.fetch(
        '/Linux_x64/100055/',
        'chromium-browser-snapshots'
      );
      assert.ok(result);
      assert.ok(result.items?.length === 1);
      // console.log(result.items);
      assert.ok(result.items[0].name === 'chrome-linux.zip');
      assert.ok(result.items[0].isDir === false);
      assert.ok(result.items[0].date);
      assert.ok(result.items[0].url);
    });
  });
});
