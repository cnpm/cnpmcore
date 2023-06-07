import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { NwjsBinary } from '../../../../app/common/adapter/binary/NwjsBinary';
import { TestUtil } from '../../../../test/TestUtil';

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
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      for (const item of result.items) {
        assert(item.isDir);
        if (item.name === 'v0.59.0/') {
          assert(item.date === '02-Dec-2021 16:40');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
      }
      assert(matchDir);
    });

    it('should fetch subdir: /v0.59.0/, /v0.59.1/x64/ work', async () => {
      app.mockHttpclient('https://nwjs2.s3.amazonaws.com/', 'GET', {
        data: await TestUtil.readFixturesFile('nwjs2.s3.amazonaws.com/v0.59.0.xml'),
        persist: false,
      });
      let result = await binary.fetch('/v0.59.0/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        // console.log(item);
        if (item.name === 'x64/') {
          assert(item.date === '-');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'nwjs-v0.59.0-win-x64.zip') {
          assert(item.date === '2021-12-02T23:35:59.000Z');
          assert(item.isDir === false);
          assert(item.size === 110828221);
          assert(item.url === 'https://dl.nwjs.io/v0.59.0/nwjs-v0.59.0-win-x64.zip');
          matchFile = true;
        }
        if (!item.isDir) {
          assert(typeof item.size === 'number');
          assert(item.size > 2);
        }
      }
      assert(matchDir);
      assert(matchFile);

      // https://nwjs2.s3.amazonaws.com/?delimiter=/&prefix=v0.59.1%2Fx64%2F
      app.mockHttpclient('https://nwjs2.s3.amazonaws.com/', 'GET', {
        data: await TestUtil.readFixturesFile('nwjs2.s3.amazonaws.com/v0.59.1.xml'),
        persist: false,
      });
      result = await binary.fetch('/v0.59.1/x64/');
      assert(result);
      assert(result.items.length === 2);
      let matchFile1 = false;
      let matchFile2 = false;
      for (const item of result.items) {
        // console.log(item);
        if (item.name === 'node.lib') {
          assert(item.date === '2021-12-21T22:41:19.000Z');
          assert(item.isDir === false);
          assert(item.size === 871984);
          assert(item.url === 'https://dl.nwjs.io/v0.59.1/x64/node.lib');
          matchFile1 = true;
        }
        if (item.name === 'nw.lib') {
          assert(item.date === '2021-12-21T22:41:19.000Z');
          assert(item.isDir === false);
          assert(item.size === 6213840);
          assert(item.url === 'https://dl.nwjs.io/v0.59.1/x64/nw.lib');
          matchFile2 = true;
        }
      }
      assert(matchFile1);
      assert(matchFile2);
    });
  });
});
