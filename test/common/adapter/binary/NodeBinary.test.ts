import { strict as assert } from 'node:assert';
import { app } from '@eggjs/mock/bootstrap';

import { NodeBinary } from '../../../../app/common/adapter/binary/NodeBinary.js';
import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/common/adapter/binary/NodeBinary.test.ts', () => {
  let binary: NodeBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(NodeBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://nodejs.org/dist/', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.html'),
      });
      const result = await binary.fetch('/', 'node');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'v0.10.40/') {
          assert(item.date === '09-Jul-2015 21:57');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'node-v0.1.100.tar.gz') {
          assert(item.date === '26-Aug-2011 16:21');
          assert(item.isDir === false);
          assert(item.size === '3813493');
          assert(item.url === 'https://nodejs.org/dist/node-v0.1.100.tar.gz');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /v16.13.1/ work', async () => {
      app.mockHttpclient('https://nodejs.org/dist/v16.13.1/', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/v16.13.1/index.html'),
      });
      const result = await binary.fetch('/v16.13.1/', 'node');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          assert(item.date === '30-Nov-2021 19:33');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert(item.date === '01-Dec-2021 16:13');
          assert(item.isDir === false);
          assert(item.size === '3153');
          assert(item.url === 'https://nodejs.org/dist/v16.13.1/SHASUMS256.txt');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /v18.15.0/ work', async () => {
      app.mockHttpclient('https://nodejs.org/dist/v18.15.0/', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/v18.15.0/index.html'),
      });
      const result = await binary.fetch('/v18.15.0/', 'node');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          assert.equal(item.date, '-');
          assert.equal(item.isDir, true);
          assert.equal(item.size, '-');
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert.equal(item.date, '04-Nov-2024 17:29');
          assert.equal(item.isDir, false);
          assert.equal(item.size, '3.2 KB');
          assert.equal(item.url, 'https://nodejs.org/dist/v18.15.0/SHASUMS256.txt');
          matchFile = true;
        }
        if (item.name === 'node-v18.15.0-win-x64.zip') {
          assert.equal(item.date, '30-Oct-2024 18:04');
          assert.equal(item.isDir, false);
          assert.equal(item.size, '29 MB');
          assert.equal(item.url, 'https://nodejs.org/dist/v18.15.0/node-v18.15.0-win-x64.zip');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /v14.0.0-nightly20200119b318926634/ work', async () => {
      app.mockHttpclient('https://nodejs.org/download/nightly/v14.0.0-nightly20200119b318926634/', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/download/nightly/v14.0.0-nightly20200119b318926634/index.html'),
      });
      const result = await binary.fetch('/v14.0.0-nightly20200119b318926634/', 'node-nightly');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile1 = false;
      let matchFile2 = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          assert(item.date === '19-Jan-2020 06:34');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert(item.date === '19-Jan-2020 07:35');
          assert(item.isDir === false);
          assert(item.size === '3797');
          assert(item.url === 'https://nodejs.org/download/nightly/v14.0.0-nightly20200119b318926634/SHASUMS256.txt');
          matchFile1 = true;
        }
        if (item.name === 'node-v14.0.0-nightly20200119b318926634-linux-s390x.tar.xz') {
          assert(item.date === '19-Jan-2020 06:03');
          assert(item.isDir === false);
          assert(item.size === '20416228');
          assert(item.url === 'https://nodejs.org/download/nightly/v14.0.0-nightly20200119b318926634/node-v14.0.0-nightly20200119b318926634-linux-s390x.tar.xz');
          matchFile2 = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir);
      assert(matchFile1);
      assert(matchFile2);
    });

    it('should skip zero size file', async () => {
      app.mockHttpclient('https://nodejs.org/download/nightly/v14.0.0-nightly20200204ee9e689df2/', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/download/nightly/v14.0.0-nightly20200204ee9e689df2/index.html'),
      });
      const result = await binary.fetch('/v14.0.0-nightly20200204ee9e689df2/', 'node-nightly');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile1 = false;
      let matchFile2 = false;
      let matchFile3 = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert(item.date === '04-Feb-2020 06:15');
          assert(item.isDir === false);
          assert(item.size === '1364');
          assert(item.url === 'https://nodejs.org/download/nightly/v14.0.0-nightly20200204ee9e689df2/SHASUMS256.txt');
          matchFile1 = true;
        }
        if (item.name === 'node-v14.0.0-nightly20200204ee9e689df2-linux-arm64.tar.gz') {
          assert(item.date === '04-Feb-2020 06:02');
          assert(item.isDir === false);
          assert(item.size === '33496011');
          assert(item.url === 'https://nodejs.org/download/nightly/v14.0.0-nightly20200204ee9e689df2/node-v14.0.0-nightly20200204ee9e689df2-linux-arm64.tar.gz');
          matchFile2 = true;
        }
        // skip 0 size file: https://nodejs.org/download/nightly/v14.0.0-nightly20200204ee9e689df2/node-v14.0.0-nightly20200204ee9e689df2-win-x86.7z
        if (item.name === 'node-v14.0.0-nightly20200204ee9e689df2-win-x86.7z') {
          matchFile3 = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(!matchDir);
      assert(matchFile1);
      assert(matchFile2);
      assert(!matchFile3);
    });

    it('should on python', async () => {
      app.mockHttpclient('https://www.python.org/ftp/python/', 'GET', {
        data: await TestUtil.readFixturesFile('www.python.org/ftp/python/index.html'),
        persist: false,
      });
      app.mockHttpclient('https://www.python.org/ftp/python/3.7.3/', 'GET', {
        data: await TestUtil.readFixturesFile('www.python.org/ftp/python/3.7.3.html'),
        persist: false,
      });
      app.mockHttpclient('https://www.python.org/ftp/python/src/', 'GET', {
        data: await TestUtil.readFixturesFile('www.python.org/ftp/python/src.html'),
        persist: false,
      });

      let result = await binary.fetch('/', 'python');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === '2.7.18/') {
          assert(item.date === '20-Apr-2020 13:48');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === '3.7.3/') {
          assert(item.date === '25-Mar-2019 23:04');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
        if (item.name === 'README.html') {
          assert(item.date);
          assert(item.isDir === false);
          assert(item.size);
          assert(item.url === 'https://www.python.org/ftp/python/README.html');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir1);
      assert(matchDir2);
      assert(matchFile);

      result = await binary.fetch('/3.7.3/', 'python');
      assert(result);
      assert(result.items.length > 0);

      matchDir1 = false;
      matchDir2 = false;
      matchFile = false;
      for (const item of result.items) {
        if (item.name === 'win32/') {
          assert(item.date === '25-Mar-2019 23:04');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'amd64/') {
          assert(item.date === '25-Mar-2019 23:03');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
        if (item.name === 'python-3.7.3.exe') {
          assert(item.date === '25-Mar-2019 23:04');
          assert(item.isDir === false);
          assert(item.size === '25424128');
          assert(item.url === 'https://www.python.org/ftp/python/3.7.3/python-3.7.3.exe');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'string');
          assert(item.size.length > 2);
        }
      }
      assert(matchDir1);
      assert(matchDir2);
      assert(matchFile);

      result = await binary.fetch('/src/', 'python');
      assert(result);
      assert(result.items.length > 0);
      assert(!result.items.find(item => item.name === 'Python-1.6.tar.gz'));
    });
  });
});
