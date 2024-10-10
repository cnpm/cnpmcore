import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';
import { GithubBinary } from '../../../../app/common/adapter/binary/GithubBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/GithubBinary.test.ts', () => {
  let binary: GithubBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(GithubBinary);
  });

  describe('fetch()', () => {
    it('should fetch root and subdir work', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });
      let result = await binary.fetch('/', 'electron');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name.endsWith('/'));
        assert(item.isDir);
        assert(item.size === '-');
      }

      const firstDir = `/${result.items[0].name}`;
      result = await binary.fetch(firstDir, 'electron');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(!item.name.endsWith('/'));
        assert(!item.isDir);
      }
      // console.log(result.items);
    });

    it('should fetch skia-canvas', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('skia-canvas-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/samizdatco\/skia-canvas\/releases/, 'GET', {
        data: response,
        status: 200,
      });
      let result = await binary.fetch('/', 'skia-canvas');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir = false;
      for (const item of result.items) {
        assert(item.isDir === true);
        if (item.name === 'v0.9.30/') {
          matchDir = true;
        }
      }
      assert(matchDir);

      result = await binary.fetch('/v0.9.24/', 'skia-canvas');
      assert(result?.items.every(item => !/{.*}/.test(item.url)));

      result = await binary.fetch('/v0.9.30/', 'skia-canvas');
      assert(result);
      assert(result.items.length > 0);
      console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        if (item.name === 'skia-canvas-v0.9.30-darwin-arm64.tar.gz') {
          assert(item.date === '2024-08-26T18:04:13Z');
          assert(item.size === 7547563);
          assert.equal(item.url, 'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-darwin-arm64.tar.gz');
          matchFile1 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-linux-arm-glibc.tar.gz') {
          assert(item.date === '2024-08-26T18:04:17Z');
          assert(item.size === 8836353);
          assert.equal(item.url, 'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-linux-arm-glibc.tar.gz');
          matchFile2 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-win32-x64.tar.gz') {
          assert(item.date === '2024-08-26T18:04:29Z');
          assert(item.size === 7497076);
          assert.equal(item.url, 'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-win32-x64.tar.gz');
          matchFile3 = true;
        }
      }
      assert(matchFile1);
      assert(matchFile2);
      assert(matchFile3);
    });
  });
});
