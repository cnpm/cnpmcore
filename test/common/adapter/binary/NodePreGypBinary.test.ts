import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { NodePreGypBinary } from '../../../../app/common/adapter/binary/NodePreGypBinary';
import { TestUtil } from '../../../../test/TestUtil';

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
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.24.11/') {
          assert(item.date === '2021-07-23T18:07:10.297Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v1.14.0/') {
          assert(item.date === '2018-08-10T16:59:52.551Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);

      result = await binary.fetch('/v1.24.11/', 'grpc');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name);
        assert(item.date);
        assert(item.url.includes('/v1.24.11/'));
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
      }
    });

    it('should fetch grpc-tools', async () => {
      app.mockHttpclient('https://registry.npmjs.com/grpc-tools', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/grpc-tools.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      let result = await binary.fetch('/', 'grpc-tools');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v1.11.2/') {
          assert(item.date === '2021-06-18T17:01:49.917Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v0.14.1/') {
          assert(item.date === '2016-05-11T22:54:25.492Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);

      result = await binary.fetch('/v1.11.2/', 'grpc-tools');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name);
        assert(item.date);
        assert(item.url.includes('/v1.11.2/'));
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
      }
    });

    it('should fetch nodegit', async () => {
      app.mockHttpclient('https://registry.npmjs.com/nodegit', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/nodegit.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      const result = await binary.fetch('/', 'nodegit');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        if (item.name === 'nodegit-v0.27.0-node-v64-linux-x64.tar.gz') {
          assert(item.date === '2020-07-28T19:27:28.363Z');
          assert(item.size === '-');
          assert(item.url === 'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.27.0-node-v64-linux-x64.tar.gz');
          matchFile1 = true;
        }
        if (item.name === 'nodegit-v0.25.0-node-v64-darwin-x64.tar.gz') {
          assert(item.date === '2019-08-09T16:46:10.709Z');
          assert(item.size === '-');
          assert(item.url === 'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.25.0-node-v64-darwin-x64.tar.gz');
          matchFile2 = true;
        }
        if (item.name === 'nodegit-v0.26.0-node-v57-win32-x64.tar.gz') {
          assert(item.date === '2019-09-11T15:47:20.192Z');
          assert(item.size === '-');
          assert(item.url === 'https://axonodegit.s3.amazonaws.com/nodegit/nodegit/nodegit-v0.26.0-node-v57-win32-x64.tar.gz');
          matchFile3 = true;
        }
        if (item.name === 'nodegit-v0.27.0-node-v64-linux-ia32.tar.gz') {
          throw new Error('should not run this');
        }
      }
      assert(matchFile1);
      assert(matchFile2);
      assert(matchFile3);
    });

    it('should fetch skia-canvas', async () => {
      app.mockHttpclient('https://registry.npmjs.com/skia-canvas', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/skia-canvas.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
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
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404, 403 ]);
        if (item.name === 'darwin-arm64-napi-v6-unknown.tar.gz') {
          assert(item.date === '2022-06-08T01:53:43.908Z');
          assert(item.size === '-');
          assert(item.url === 'https://skia-canvas.s3.us-east-1.amazonaws.com/v0.9.30/darwin-arm64-napi-v6-unknown.tar.gz');
          matchFile1 = true;
        }
        if (item.name === 'linux-arm-napi-v6-glibc.tar.gz') {
          assert(item.date === '2022-06-08T01:53:43.908Z');
          assert(item.size === '-');
          assert(item.url === 'https://skia-canvas.s3.us-east-1.amazonaws.com/v0.9.30/linux-arm-napi-v6-glibc.tar.gz');
          matchFile2 = true;
        }
        if (item.name === 'win32-x64-napi-v6-unknown.tar.gz') {
          assert(item.date === '2022-06-08T01:53:43.908Z');
          assert(item.size === '-');
          assert(item.url === 'https://skia-canvas.s3.us-east-1.amazonaws.com/v0.9.30/win32-x64-napi-v6-unknown.tar.gz');
          matchFile3 = true;
        }
      }
      assert(matchFile1);
      assert(matchFile2);
      assert(matchFile3);
    });

    it('should fetch wrtc', async () => {
      app.mockHttpclient('https://registry.npmjs.com/wrtc', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/wrtc.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      let result = await binary.fetch('/', 'wrtc');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchDir = false;
      for (const item of result.items) {
        assert(item.isDir === true);
        if (item.name === 'v0.4.7/') {
          matchDir = true;
        }
      }
      assert(matchDir);

      result = await binary.fetch('/v0.4.7/', 'wrtc');
      assert(result);
      assert(result.items.length > 0);
      // console.log(JSON.stringify(result.items, null, 2));
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
        if (item.name === 'linux-arm64.tar.gz') {
          assert(item.date === '2021-01-10T15:43:35.384Z');
          assert(item.size === '-');
          assert(item.url === 'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/linux-arm64.tar.gz');
          matchFile1 = true;
        }
        if (item.name === 'linux-x64.tar.gz') {
          assert(item.date === '2021-01-10T15:43:35.384Z');
          assert(item.size === '-');
          assert(item.url === 'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/linux-x64.tar.gz');
          matchFile2 = true;
        }
        if (item.name === 'darwin-x64.tar.gz') {
          assert(item.date === '2021-01-10T15:43:35.384Z');
          assert(item.size === '-');
          assert(item.url === 'https://node-webrtc.s3.amazonaws.com/wrtc/v0.4.7/Release/darwin-x64.tar.gz');
          matchFile3 = true;
        }
      }
      assert(matchFile1);
      assert(matchFile2);
      assert(matchFile3);
    });

    it('should fetch libpg-query', async () => {
      app.mockHttpclient('https://registry.npmjs.com/libpg-query', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/libpg-query.json'),
      });
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      });
      const result = await binary.fetch('/', 'libpg-query-node');
      assert(result);
      assert(result.items.length > 0);
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      let matchFile4 = false;
      let matchFile5 = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404 ]);
        if (item.name === 'queryparser-v13.2.1-node-v108-darwin-arm64.tar.gz') {
          assert(item.date === '2022-03-11T00:49:54.060Z');
          assert(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-darwin-arm64.tar.gz',
          );
          matchFile1 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-darwin-x64.tar.gz') {
          assert(item.date === '2022-03-11T00:49:54.060Z');
          assert(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-darwin-x64.tar.gz',
          );
          matchFile2 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-linux-arm.tar.gz') {
          assert(item.date === '2022-03-11T00:49:54.060Z');
          assert(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-linux-arm.tar.gz',
          );
          matchFile3 = true;
        }
        if (item.name === 'queryparser-v13.2.1-node-v108-linux-x64.tar.gz') {
          assert(item.date === '2022-03-11T00:49:54.060Z');
          assert(item.size === '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.2.1-node-v108-linux-x64.tar.gz',
          );
          matchFile4 = true;
        }
        if (item.name === 'queryparser-v13.3.1-node-v93-darwin-arm64.tar.gz') {
          assert.equal(item.date, '2022-12-22T00:43:58.077Z');
          assert.equal(item.size, '-');
          assert.equal(
            item.url,
            'https://supabase-public-artifacts-bucket.s3.amazonaws.com/libpg-query-node/queryparser-v13.3.1-node-v93-darwin-arm64.tar.gz',
          );
          matchFile5 = true;
        }
      }
      assert(matchFile1);
      assert(matchFile2);
      assert(matchFile3);
      assert(matchFile4);
      assert(matchFile5);
    });
  });
});
