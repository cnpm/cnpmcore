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
      const response = await TestUtil.readJSONFile(
        TestUtil.getFixtures('electron-releases.json')
      );
      app.mockHttpclient(
        /https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );
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
  });
});
