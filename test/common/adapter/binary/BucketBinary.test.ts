import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { BucketBinary } from '../../../../app/common/adapter/binary/BucketBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/BucketBinary.test.ts', () => {
  let binary: BucketBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(BucketBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient(
        'https://chromedriver.storage.googleapis.com/',
        'GET',
        {
          data: await TestUtil.readFixturesFile(
            'chromedriver.storage.googleapis.com/index.xml'
          ),
          persist: false,
        }
      );
      const result = await binary.fetch('/', 'chromedriver');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === '97.0.4692.71/') {
          assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/.test(item.date));
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'LATEST_RELEASE_70.0.3538') {
          assert.ok(item.date === '2018-11-06T07:19:08.413Z');
          assert.ok(item.size === 12);
          assert.ok(
            item.url ===
              'https://chromedriver.storage.googleapis.com/LATEST_RELEASE_70.0.3538'
          );
          matchFile = true;
        }
      }
      assert.ok(matchDir);
      assert.ok(matchFile);
    });

    it('should fetch subdir: /97.0.4692.71/ work', async () => {
      app.mockHttpclient(
        'https://chromedriver.storage.googleapis.com/',
        'GET',
        {
          data: await TestUtil.readFixturesFile(
            'chromedriver.storage.googleapis.com/97.0.4692.71.xml'
          ),
          persist: false,
        }
      );
      const result = await binary.fetch('/97.0.4692.71/', 'chromedriver');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchFile = false;
      for (const item of result.items) {
        assert.ok(item.isDir === false);
        assert.ok(typeof item.size === 'number');
        assert.ok(item.size > 2);
        // console.log(item);
        if (item.name === 'chromedriver_mac64_m1.zip') {
          assert.ok(item.date === '2022-01-05T05:45:15.397Z');
          assert.ok(item.size === 7_846_919);
          assert.ok(
            item.url ===
              'https://chromedriver.storage.googleapis.com/97.0.4692.71/chromedriver_mac64_m1.zip'
          );
          matchFile = true;
        }
      }
      assert.ok(matchFile);
    });

    it('should ignore dir with size = 0', async () => {
      app.mockHttpclient(
        'https://selenium-release.storage.googleapis.com/',
        'GET',
        {
          data: await TestUtil.readFixturesFile(
            'selenium-release.storage.googleapis.com/2.43.xml'
          ),
          persist: false,
        }
      );
      // https://selenium-release.storage.googleapis.com/?delimiter=/&prefix=2.43/
      const result = await binary.fetch('/2.43/', 'selenium');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(item.name !== '2.43');
      }
    });

    it('should ignore AWSLogs/', async () => {
      app.mockHttpclient('https://node-inspector.s3.amazonaws.com/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'node-inspector.s3.amazonaws.com/index.xml'
        ),
        persist: false,
      });
      const result = await binary.fetch('/', 'node-inspector');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      for (const item of result.items) {
        assert.ok(item.name !== 'AWSLogs/');
      }
    });
  });
});
