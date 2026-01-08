import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { ElectronBinary } from '../../../../app/common/adapter/binary/ElectronBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/ElectronBinary.test.ts', () => {
  let binary: ElectronBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(ElectronBinary);
  });
  describe('fetch()', () => {
    it('should fetch root and subdir work', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });
      let result = await binary.fetch('/');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(result.items);
      for (const item of result.items) {
        assert.ok(item.name.endsWith('/'));
        assert.ok(item.isDir);
        assert.ok(item.size === '-');
      }

      const firstDir = result.items[0].name;
      const secondDir = result.items[1].name;
      assert.ok(firstDir === `v${secondDir}`);
      result = await binary.fetch(`/${firstDir}`);
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(!item.name.endsWith('/'));
        assert.ok(!item.isDir);
      }
      const firstItemsLength = result.items.length;
      // console.log(result.items);

      result = await binary.fetch(`/${secondDir}`);
      assert.ok(result);
      assert.ok(result.items.length === firstItemsLength);
      for (const item of result.items) {
        assert.ok(!item.name.endsWith('/'));
        assert.ok(!item.isDir);
      }
      // console.log(result.items);
    });

    it('should include headers file in version directory', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });

      // test with v prefix
      let result = await binary.fetch('/v16.0.5/');
      assert.ok(result);
      const headersItem = result.items.find((item) => item.name === 'node-v16.0.5-headers.tar.gz');
      assert.ok(headersItem, 'headers file should exist');
      assert.equal(headersItem.isDir, false);
      assert.equal(headersItem.url, 'https://www.electronjs.org/headers/v16.0.5/node-v16.0.5-headers.tar.gz');
      assert.equal(headersItem.size, '-');

      // test without v prefix - should have the same headers item
      result = await binary.fetch('/16.0.5/');
      assert.ok(result);
      const headersItem2 = result.items.find((item) => item.name === 'node-v16.0.5-headers.tar.gz');
      assert.ok(headersItem2, 'headers file should exist for non-v-prefixed directory');
      assert.equal(headersItem2.url, 'https://www.electronjs.org/headers/v16.0.5/node-v16.0.5-headers.tar.gz');
    });
  });
});
