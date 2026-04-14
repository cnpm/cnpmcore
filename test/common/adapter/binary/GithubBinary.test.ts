import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { GithubBinary } from '../../../../app/common/adapter/binary/GithubBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

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
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('skia-canvas-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/samizdatco\/skia-canvas\/releases/, 'GET', {
        data: response,
        status: 200,
      });
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
      assert.ok(result?.items.every((item) => !/{.*}/.test(item.url)));

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
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-darwin-arm64.tar.gz',
          );
          matchFile1 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-linux-arm-glibc.tar.gz') {
          assert.ok(item.date === '2024-08-26T18:04:17Z');
          assert.ok(item.size === 8_836_353);
          assert.equal(
            item.url,
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-linux-arm-glibc.tar.gz',
          );
          matchFile2 = true;
        }
        if (item.name === 'skia-canvas-v0.9.30-win32-x64.tar.gz') {
          assert.ok(item.date === '2024-08-26T18:04:29Z');
          assert.ok(item.size === 7_497_076);
          assert.equal(
            item.url,
            'https://github.com/samizdatco/skia-canvas/releases/download/v0.9.30/skia-canvas-v0.9.30-win32-x64.tar.gz',
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should fetch @matrix-org/matrix-sdk-crypto-nodejs', async () => {
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/matrix-org\/matrix-rust-sdk-crypto-nodejs\/releases/, 'GET', {
        data: [
          {
            tag_name: 'v0.4.0',
            url: 'https://api.github.com/repos/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/277244048',
            published_at: '2026-01-16T01:50:49Z',
            tarball_url: 'https://api.github.com/repos/matrix-org/matrix-rust-sdk-crypto-nodejs/tarball/v0.4.0',
            zipball_url: 'https://api.github.com/repos/matrix-org/matrix-rust-sdk-crypto-nodejs/zipball/v0.4.0',
            assets: [
              {
                name: 'matrix-sdk-crypto.linux-x64-gnu.node',
                size: 22_027_000,
                updated_at: '2026-01-16T01:31:27Z',
                browser_download_url:
                  'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download/v0.4.0/matrix-sdk-crypto.linux-x64-gnu.node',
              },
              {
                name: 'matrix-sdk-crypto.win32-x64-msvc.node',
                size: 15_202_816,
                updated_at: '2026-01-16T01:37:41Z',
                browser_download_url:
                  'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download/v0.4.0/matrix-sdk-crypto.win32-x64-msvc.node',
              },
            ],
          },
        ],
        status: 200,
      });
      let result = await binary.fetch('/', '@matrix-org/matrix-sdk-crypto-nodejs');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        if (item.name === 'v0.4.0/') {
          assert.equal(item.date, '2026-01-16T01:50:49Z');
          assert.equal(item.size, '-');
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch('/v0.4.0/', '@matrix-org/matrix-sdk-crypto-nodejs');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        if (item.name === 'matrix-sdk-crypto.linux-x64-gnu.node') {
          assert.equal(item.date, '2026-01-16T01:31:27Z');
          assert.equal(item.size, 22_027_000);
          assert.equal(
            item.url,
            'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download/v0.4.0/matrix-sdk-crypto.linux-x64-gnu.node',
          );
          matchFile1 = true;
        }
        if (item.name === 'matrix-sdk-crypto.win32-x64-msvc.node') {
          assert.equal(item.date, '2026-01-16T01:37:41Z');
          assert.equal(item.size, 15_202_816);
          assert.equal(
            item.url,
            'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download/v0.4.0/matrix-sdk-crypto.win32-x64-msvc.node',
          );
          matchFile2 = true;
        }
        if (item.name === 'v0.4.0.tar.gz') {
          assert.equal(
            item.url,
            'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/archive/v0.4.0.tar.gz',
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should fetch protobuf', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('protobuf-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/protocolbuffers\/protobuf\/releases/, 'GET', {
        data: response,
        status: 200,
      });
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
      assert.ok(result?.items.every((item) => !/{.*}/.test(item.url)));

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
            'https://github.com/protocolbuffers/protobuf/releases/download/v28.2/protoc-28.2-linux-aarch_64.zip',
          );
          matchFile1 = true;
        }
      }
      assert.ok(matchFile1);
    });

    it('should fetch ripgrep-prebuilt', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('ripgrep-prebuilt-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/microsoft\/ripgrep-prebuilt\/releases/, 'GET', {
        data: response,
        status: 200,
      });
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
          assert.equal(item.date, '2024-10-01T11:30:01Z');
          assert.equal(item.size, 1_234_567);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-pc-windows-msvc.zip',
          );
          matchFile1 = true;
        }
        if (item.name === 'ripgrep-v14.1.1-1-x86_64-apple-darwin.tar.gz') {
          assert.equal(item.date, '2024-10-01T11:30:06Z');
          assert.equal(item.size, 2_345_678);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-apple-darwin.tar.gz',
          );
          matchFile2 = true;
        }
        if (item.name === 'ripgrep-v14.1.1-1-x86_64-unknown-linux-musl.tar.gz') {
          assert.equal(item.date, '2024-10-01T11:30:11Z');
          assert.equal(item.size, 3_456_789);
          assert.equal(
            item.url,
            'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v14.1.1-1/ripgrep-v14.1.1-1-x86_64-unknown-linux-musl.tar.gz',
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should use custom perPage config for python-build-standalone', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('python-build-standalone-releases.json'));
      let requestUrl = '';
      app.mockHttpclient(
        /https:\/\/api\.github\.com\/repos\/astral-sh\/python-build-standalone\/releases/,
        'GET',
        (_url: string) => {
          requestUrl = _url;
          return {
            data: response,
            status: 200,
          };
        },
      );
      await binary.initFetch('python-build-standalone');
      const result = await binary.fetch('/', 'python-build-standalone');
      assert.ok(result);
      // Verify that perPage=10 is used instead of default 100
      assert.ok(requestUrl.includes('per_page=10'), `Expected per_page=10 in URL: ${requestUrl}`);
      assert.ok(requestUrl.includes('page=1'));
    });

    it('should use default perPage=100 when not configured', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      let requestUrl = '';
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', (_url: string) => {
        requestUrl = _url;
        return {
          data: response,
          status: 200,
        };
      });
      await binary.initFetch('electron');
      const result = await binary.fetch('/', 'electron');
      assert.ok(result);
      // Verify that default per_page=100 is used
      assert.ok(requestUrl.includes('per_page=100'), `Expected per_page=100 in URL: ${requestUrl}`);
    });
  });
});
