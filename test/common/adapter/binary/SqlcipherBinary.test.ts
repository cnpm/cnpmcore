import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { SqlcipherBinary } from '../../../../app/common/adapter/binary/SqlcipherBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/SqlcipherBinary.test.ts', () => {
  let binary: SqlcipherBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(SqlcipherBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/@journeyapps/sqlcipher', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/@journeyapps/sqlcipher.json'),
        persist: false,
      });
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v5.3.1/') {
          assert(item.date === '2021-12-14T13:12:31.587Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v5.0.0/') {
          assert(item.date === '2020-09-25T13:05:17.722Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should fetch subdir: /v5.3.1/ work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/@journeyapps/sqlcipher', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/@journeyapps/sqlcipher.json'),
        persist: false,
      });
      const result = await binary.fetch('/v5.3.1/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(item.name.endsWith('.tar.gz'));
        assert.deepEqual(item.ignoreDownloadStatuses, [ 404, 403 ]);
      }
      app.mockAgent().assertNoPendingInterceptors();
    });
  });
});
