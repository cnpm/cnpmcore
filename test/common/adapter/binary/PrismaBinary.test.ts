import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';
import { PrismaBinary } from '../../../../app/common/adapter/binary/PrismaBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/PrismaBinary.test.ts', () => {
  let binary: PrismaBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(PrismaBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/@prisma/engines', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/prisma-engines.json'),
        persist: false,
      });
      await binary.initFetch();
      const result = await binary.fetch('/all_commits/', 'prisma');
      // console.log(result);
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      let matchDir3 = false;
      for (const item of result.items) {
        if (item.name === '30a25f01b482be48fcbcde1f9b821af8fd40192f/') {
          assert.equal(item.date, '2021-10-26T11:08:57.551Z');
          assert.equal(item.isDir, true);
          assert.equal(item.size, '-');
          matchDir1 = true;
        }
        if (item.name === 'd9a4c5988f480fa576d43970d5a23641aa77bc9c/') {
          assert.equal(item.date, '2023-05-08T16:28:03.491Z');
          assert.equal(item.isDir, true);
          assert.equal(item.size, '-');
          matchDir2 = true;
        }
        if (item.name === '61023c35d2c8762f66f09bc4183d2f630b541d08/') {
          assert.equal(item.date, '2023-05-23T16:41:24.450Z');
          assert.equal(item.isDir, true);
          assert.equal(item.size, '-');
          matchDir3 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);
      assert(matchDir3);
    });

    it('should fetch subdir: /61023c35d2c8762f66f09bc4183d2f630b541d08/ work', async () => {
      app.mockHttpclient('https://list-binaries.prisma-orm.workers.dev/', 'GET', {
        data: await TestUtil.readFixturesFile('list-binaries.prisma-orm.workers.dev/61023c35d2c8762f66f09bc4183d2f630b541d08.json'),
        persist: false,
      });
      let result = await binary.fetch('/61023c35d2c8762f66f09bc4183d2f630b541d08/', 'prisma');
      assert(result);
      assert.equal(result.items.length, 16);
      assert.equal(result.items[0].name, 'darwin-arm64/');
      assert.equal(result.items[1].name, 'darwin/');
      assert.equal(result.items[2].name, 'debian-openssl-1.0.x/');
      assert.equal(result.items[3].name, 'debian-openssl-1.1.x/');
      assert.equal(result.items[0].isDir, true);

      app.mockHttpclient('https://list-binaries.prisma-orm.workers.dev/', 'GET', {
        data: await TestUtil.readFixturesFile('list-binaries.prisma-orm.workers.dev/61023c35d2c8762f66f09bc4183d2f630b541d08-darwin-arm64.json'),
        persist: false,
      });
      result = await binary.fetch('/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/', 'prisma');
      assert(result);
      assert.equal(result.items.length, 20);
      assert.equal(result.items[0].name, 'libquery_engine.dylib.node.gz.sha256');
      assert.equal(result.items[0].url, 'https://binaries.prisma.sh/all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/libquery_engine.dylib.node.gz.sha256');
      assert.equal(result.items[0].isDir, false);
      assert.equal(result.items[0].size, 96);
      assert.equal(result.items[0].date, '2023-05-23T15:41:33.861Z');
      assert.equal(result.items[1].name, 'libquery_engine.dylib.node.gz.sig');
      assert.equal(result.items[1].url, 'https://binaries.prisma.sh/all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/libquery_engine.dylib.node.gz.sig');
      assert.equal(result.items[1].isDir, false);
      assert.equal(result.items[1].size, 566);
      assert.equal(result.items[1].date, '2023-05-23T15:41:39.035Z');
    });
  });
});
