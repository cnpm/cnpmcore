import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { GithubBinary } from '../../../../app/common/adapter/binary/GithubBinary.js';
import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/common/adapter/binary/GithubBinary.test.ts', () => {
  let binary: GithubBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(GithubBinary);
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
      let result = await binary.fetch('/', 'electron');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(item.name.endsWith('/'));
        assert.ok(item.isDir);
        assert.ok(item.size === '-');
      }

      const firstDir = `/${result.items[0].name}`;
      result = await binary.fetch(firstDir, 'electron');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(!item.name.endsWith('/'));
        assert.ok(!item.isDir);
      }
      // console.log(result.items);
    });

    it('should fetch skia-canvas', async () => {
      const response = await TestUtil.readJSONFile(
        TestUtil.getFixtures('skia-canvas-releases.json')
      );
      app.mockHttpclient(
        /https:\/\/api\.github\.com\/repos\/samizdatco\/skia-canvas\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );
      let result = await binary.fetch('/', 'skia-canvas');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        if (item.name === 'v0.9.30/') {
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch('/v0.9.24/', 'skia-canvas');
      assert.ok(result?.items.every(item => !/{.*}/.test(item.url)));

      result = await binary.fetch('/v0.9.30/', 'skia-canvas');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        if (item.name === 'skia-canvas-v0.9.30-darwin-arm64.tar.gz') {
          assert.ok(item.date === '2024-08-26T18:04:13Z');
          assert.ok(item.size === 7_547_563);
          assert.equal(
            item.url,
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-darwin-arm64.tar.gz'
          );
          matchFile1 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-linux-arm-glibc.tar.gz') {
          assert.ok(item.date === '2024-08-26T18:04:17Z');
          assert.ok(item.size === 8_836_353);
          assert.equal(
            item.url,
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-linux-arm-glibc.tar.gz'
          );
          matchFile2 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-win32-x64.tar.gz') {
          assert.ok(item.date === '2024-08-26T18:04:29Z');
          assert.ok(item.size === 7_497_076);
          assert.equal(
            item.url,
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-win32-x64.tar.gz'
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should fetch protobuf', async () => {
      const response = await TestUtil.readJSONFile(
        TestUtil.getFixtures('protobuf-releases.json')
      );
      app.mockHttpclient(
        /https:\/\/api\.github\.com\/repos\/protocolbuffers\/protobuf\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );
      let result = await binary.fetch('/', 'protobuf');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        if (item.name === 'v28.2/') {
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch('/v28.2/', 'protobuf');
      assert.ok(result?.items.every(item => !/{.*}/.test(item.url)));

      result = await binary.fetch('/v28.2/', 'protobuf');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        if (item.name === 'protoc-28.2-linux-aarch_64.zip') {
          assert.ok(item.date === '2024-09-18T21:02:40Z');
          assert.ok(item.size === 3_218_760);
          assert.equal(
            item.url,
            'https://github.com/protocolbuffers/protobuf/releases/download/v28.2/protoc-28.2-linux-aarch_64.zip'
          );
          matchFile1 = true;
        }
      }
      assert.ok(matchFile1);
    });

    it('should fetch ripgrep-prebuilt', async () => {
      const response = await TestUtil.readJSONFile(
        TestUtil.getFixtures('ripgrep-prebuilt-releases.json')
      );
      app.mockHttpclient(
        /https:\/\/api\.github\.com\/repos\/microsoft\/ripgrep-prebuilt\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );
      let result = await binary.fetch('/', 'ripgrep-prebuilt');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        if (item.name === 'v14.1.1-1/') {
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch('/v14.1.1-1/', 'ripgrep-prebuilt');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        if (item.name === 'ripgrep-v14.1.1-1-x86_64-pc-windows-msvc.zip') {
          assert.ok(item.date === '2024-10-01T11:30:01Z');
          assert.ok(item.size === 1234567);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-pc-windows-msvc.zip'
          );
          matchFile1 = true;
        }
        if (item.name === 'ripgrep-v14.1.1-1-x86_64-apple-darwin.tar.gz') {
          assert.ok(item.date === '2024-10-01T11:30:06Z');
          assert.ok(item.size === 2345678);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-apple-darwin.tar.gz'
          );
          matchFile2 = true;
        }
        if (item.name === 'ripgrep-v14.1.1-1-x86_64-unknown-linux-musl.tar.gz') {
          assert.ok(item.date === '2024-10-01T11:30:11Z');
          assert.ok(item.size === 3456789);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-unknown-linux-musl.tar.gz'
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });
  });
});
