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
      // Version directory now contains both files and win-* subdirectories
      const files = result.items.filter((i) => !i.isDir);
      const dirs = result.items.filter((i) => i.isDir);
      assert.ok(files.length > 0, 'should have files');
      assert.equal(dirs.length, 3, 'should have 3 win-* directories');
      for (const item of files) {
        assert.ok(!item.name.endsWith('/'));
      }
      for (const item of dirs) {
        assert.ok(item.name.endsWith('/'));
      }
      const firstItemsLength = result.items.length;
      // console.log(result.items);

      result = await binary.fetch(`/${secondDir}`);
      assert.ok(result);
      assert.ok(result.items.length === firstItemsLength);
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

    it('should include win-x86, win-x64, win-arm64 directories in version directory', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/v16.0.5/');
      assert.ok(result);

      // Check win-x86 directory
      const winX86Dir = result.items.find((item) => item.name === 'win-x86/');
      assert.ok(winX86Dir, 'win-x86/ should exist');
      assert.equal(winX86Dir.isDir, true);

      // Check win-x64 directory
      const winX64Dir = result.items.find((item) => item.name === 'win-x64/');
      assert.ok(winX64Dir, 'win-x64/ should exist');
      assert.equal(winX64Dir.isDir, true);

      // Check win-arm64 directory
      const winArm64Dir = result.items.find((item) => item.name === 'win-arm64/');
      assert.ok(winArm64Dir, 'win-arm64/ should exist');
      assert.equal(winArm64Dir.isDir, true);
    });

    it('should return node.lib for win-x64 subdirectory', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });

      // test with v prefix
      let result = await binary.fetch('/v16.0.5/win-x64/');
      assert.ok(result);
      assert.equal(result.items.length, 1);
      const nodeLibItem = result.items.find((item) => item.name === 'node.lib');
      assert.ok(nodeLibItem, 'node.lib should exist');
      assert.equal(nodeLibItem.isDir, false);
      assert.equal(nodeLibItem.url, 'https://www.electronjs.org/headers/v16.0.5/win-x64/node.lib');

      // test without v prefix
      result = await binary.fetch('/16.0.5/win-x64/');
      assert.ok(result);
      const nodeLibItem2 = result.items.find((item) => item.name === 'node.lib');
      assert.ok(nodeLibItem2, 'node.lib should exist for non-v-prefixed directory');
      assert.equal(nodeLibItem2.url, 'https://www.electronjs.org/headers/v16.0.5/win-x64/node.lib');
    });

    it('should return node.lib for win-x86 subdirectory', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/v16.0.5/win-x86/');
      assert.ok(result);
      const nodeLibItem = result.items.find((item) => item.name === 'node.lib');
      assert.ok(nodeLibItem, 'node.lib should exist');
      assert.equal(nodeLibItem.url, 'https://www.electronjs.org/headers/v16.0.5/win-x86/node.lib');
    });

    it('should return node.lib for win-arm64 subdirectory', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/v16.0.5/win-arm64/');
      assert.ok(result);
      const nodeLibItem = result.items.find((item) => item.name === 'node.lib');
      assert.ok(nodeLibItem, 'node.lib should exist');
      assert.equal(nodeLibItem.url, 'https://www.electronjs.org/headers/v16.0.5/win-arm64/node.lib');
    });
  });
});
