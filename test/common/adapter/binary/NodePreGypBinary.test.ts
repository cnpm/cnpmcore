import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { NodePreGypBinary } from '../../../../app/common/adapter/binary/NodePreGypBinary.js';
import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/common/adapter/binary/NodePreGypBinary.test.ts', () => {
  let binary: NodePreGypBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(NodePreGypBinary);
  });
  describe('fetch()', () => {
    it('should fetch grpc', async () => {
      app.mockHttpclient('https://registry.npmjs.com/grpc', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/grpc.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      let result = await binary.fetch('/', 'grpc');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.24.11/') {
          assert.ok(item.date === '2021-07-23T18:07:10.297Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v1.14.0/') {
          assert.ok(item.date === '2018-08-10T16:59:52.551Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir2 = true;
        }
      }
      assert.ok(matchDir1);
      assert.ok(matchDir2);

      result = await binary.fetch('/v1.24.11/', 'grpc');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.ok(item.name);
        assert.ok(item.date);
        assert.ok(item.url.includes('/v1.24.11/'));
        assert.deepEqual(item.ignoreDownloadStatuses, [404]);
      }
    });

    it('should fetch grpc-tools', async () => {
      app.mockHttpclient('https://registry.npmjs.com/grpc-tools', 'GET', {
        data: await TestUtil.readFixturesFile(
          'registry.npmjs.com/grpc-tools.json'
        ),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      let result = await binary.fetch('/', 'grpc-tools');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.11.2/') {
          assert.ok(item.date === '2021-06-18T17:01:49.917Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v0.14.1/') {
          assert.ok(item.date === '2016-05-11T22:54:25.492Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir2 = true;
        }
      }
      assert.ok(matchDir1);
      assert.ok(matchDir2);

      result = await binary.fetch('/v1.11.2/', 'grpc-tools');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.ok(item.name);
        assert.ok(item.date);
        assert.ok(item.url.includes('/v1.11.2/'));
        assert.deepEqual(item.ignoreDownloadStatuses, [404]);
      }
    });

    it('should fetch nodegit', async () => {
      app.mockHttpclient('https://registry.npmjs.com/nodegit', 'GET', {
        data: await TestUtil.readFixturesFile(
          'registry.npmjs.com/nodegit.json'
        ),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      const result = await binary.fetch('/', 'nodegit');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        if (item.name === 'nodegit-v0.27.0-node-v64-linux-x64.tar.gz') {
          assert.ok(item.date === '2020-07-28T19:27:28.363Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.27.0-node-v64-linux-x64.tar.gz'
          );
          matchFile1 = true;
        }
        if (item.name === 'nodegit-v0.25.0-node-v64-darwin-x64.tar.gz') {
          assert.ok(item.date === '2019-08-09T16:46:10.709Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.25.0-node-v64-darwin-x64.tar.gz'
          );
          matchFile2 = true;
        }
        if (item.name === 'nodegit-v0.26.0-node-v57-win32-x64.tar.gz') {
          assert.ok(item.date === '2019-09-11T15:47:20.192Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.26.0-node-v57-win32-x64.tar.gz'
          );
          matchFile3 = true;
        }
        if (item.name === 'nodegit-v0.27.0-node-v64-linux-ia32.tar.gz') {
          throw new Error('should not run this');
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should fetch wrtc', async () => {
      app.mockHttpclient('https://registry.npmjs.com/wrtc', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/wrtc.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      let result = await binary.fetch('/', 'wrtc');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir = false;
      for (const item of result.items) {
        assert.ok(item.isDir === true);
        if (item.name === 'v0.4.7/') {
          matchDir = true;
        }
      }
      assert.ok(matchDir);

      result = await binary.fetch('/v0.4.7/', 'wrtc');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.deepEqual(item.ignoreDownloadStatuses, [404]);
        if (item.name === 'linux-arm64.tar.gz') {
          assert.ok(item.date === '2021-01-10T15:43:35.384Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/linux-arm64.tar.gz'
          );
          matchFile1 = true;
        }
        if (item.name === 'linux-x64.tar.gz') {
          assert.ok(item.date === '2021-01-10T15:43:35.384Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/linux-x64.tar.gz'
          );
          matchFile2 = true;
        }
        if (item.name === 'darwin-x64.tar.gz') {
          assert.ok(item.date === '2021-01-10T15:43:35.384Z');
          assert.ok(item.size === '-');
          assert.ok(
            item.url ===
              'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/darwin-x64.tar.gz'
          );
          matchFile3 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
    });

    it('should fetch libpg-query', async () => {
      app.mockHttpclient('https://registry.npmjs.com/libpg-query', 'GET', {
        data: await TestUtil.readFixturesFile(
          'registry.npmjs.com/libpg-query.json'
        ),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      const result = await binary.fetch('/', 'libpg-query-node');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      let matchFile4 = false;
      let matchFile5 = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.deepEqual(item.ignoreDownloadStatuses, [404]);
        if (item.name === 'queryparser-v13.2.1-node-v108-darwin-arm64.tar.gz') {
          assert.ok(item.date === '2022-03-11T00:49:54.060Z');
          assert.ok(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-darwin-arm64.tar.gz'
          );
          matchFile1 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-darwin-x64.tar.gz') {
          assert.ok(item.date === '2022-03-11T00:49:54.060Z');
          assert.ok(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-darwin-x64.tar.gz'
          );
          matchFile2 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-linux-arm.tar.gz') {
          assert.ok(item.date === '2022-03-11T00:49:54.060Z');
          assert.ok(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-linux-arm.tar.gz'
          );
          matchFile3 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-linux-x64.tar.gz') {
          assert.ok(item.date === '2022-03-11T00:49:54.060Z');
          assert.ok(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-linux-x64.tar.gz'
          );
          matchFile4 = true;
        }
        if (item.name === 'queryparser-v13.3.1-node-v93-darwin-arm64.tar.gz') {
          assert.equal(item.date, '2022-12-22T00:43:58.077Z');
          assert.equal(item.size, '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.3.1-node-v93-darwin-arm64.tar.gz'
          );
          matchFile5 = true;
        }
      }
      assert.ok(matchFile1);
      assert.ok(matchFile2);
      assert.ok(matchFile3);
      assert.ok(matchFile4);
      assert.ok(matchFile5);
    });
  });
});
