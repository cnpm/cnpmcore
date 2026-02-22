import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { SqlcipherBinary } from '../../../../app/common/adapter/binary/SqlcipherBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

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
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === 'v5.3.1/') {
          assert.ok(item.date === '2021-12-14T13:12:31.587Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === 'v5.0.0/') {
          assert.ok(item.date === '2020-09-25T13:05:17.722Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir2 = true;
        }
      }
      assert.ok(matchDir1);
      assert.ok(matchDir2);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should fetch subdir: /v5.3.1/ work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/@journeyapps/sqlcipher', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/@journeyapps/sqlcipher.json'),
        persist: false,
      });
      const result = await binary.fetch('/v5.3.1/');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.ok(item.name.endsWith('.tar.gz'));
        assert.deepEqual(item.ignoreDownloadStatuses, [404, 403]);
      }
      app.mockAgent().assertNoPendingInterceptors();
    });
  });
});
