import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { NwjsBinary } from '../../../../app/common/adapter/binary/NwjsBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/NwjsBinary.test.ts', () => {
  let binary: NwjsBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(NwjsBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://dl.nwjs.io/', 'GET', {
        data: await TestUtil.readFixturesFile('dl.nwjs.io/index.html'),
        persist: false,
      });
      const result = await binary.fetch('/');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        if (item.name === 'v0.59.0/') {
          assert.ok(item.date === '02-Dec-2021 16:40');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir = true;
        }
      }
      assert.ok(matchDir);
    });

    it('should fetch subdir: /v0.59.0/ work', async () => {
      app.mockHttpclient('https://dl.nwjs.io/v0.59.0/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'dl.nwjs.io/v0.59.0/index.html'
        ),
        persist: false,
      });
      const result = await binary.fetch('/v0.59.0/');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'x64/') {
          assert.ok(item.date === '02-Dec-2021 23:35');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'nwjs-v0.59.0-win-x64.zip') {
          assert.ok(item.date === '02-Dec-2021 23:35');
          assert.ok(item.isDir === false);
          assert.ok(item.size === '106M');
          assert.ok(
            item.url === 'https://dl.nwjs.io/v0.59.0/nwjs-v0.59.0-win-x64.zip'
          );
          matchFile = true;
        }
      }
      assert.ok(matchDir);
      assert.ok(matchFile);
    });

    it('should fetch deeper subdir: /v0.59.1/x64/ work', async () => {
      app.mockHttpclient('https://dl.nwjs.io/v0.59.1/x64/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'dl.nwjs.io/v0.59.1/x64/index.html'
        ),
        persist: false,
      });
      const result = await binary.fetch('/v0.59.1/x64/');
      assert.ok(result);
      assert.ok(result.items.length === 2);
      let matchFile1 = false;
      let matchFile2 = false;
      for (const item of result.items) {
        if (item.name === 'node.lib') {
          assert.ok(item.date === '21-Dec-2021 22:41');
          assert.ok(item.isDir === false);
          assert.ok(item.size === '852K');
          assert.ok(item.url === 'https://dl.nwjs.io/v0.59.1/x64/node.lib');
          matchFile1 = true;
        }
        if (item.name === 'nw.lib') {
          assert.ok(item.date === '21-Dec-2021 22:41');
          assert.ok(item.isDir === false);
          assert.ok(item.size === '5.9M');
          assert.ok(item.url === 'https://dl.nwjs.io/v0.59.1/x64/nw.lib');
          matchFile2 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
    });
  });
});
