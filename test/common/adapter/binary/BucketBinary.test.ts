import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { BucketBinary } from '../../../../app/common/adapter/binary/BucketBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/BucketBinary.test.ts', () => {
  let binary: BucketBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(BucketBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://chromedriver.storage.googleapis.com/', 'GET', {
        data: await TestUtil.readFixturesFile('chromedriver.storage.googleapis.com/index.xml'),
        persist: false,
      });
      const result = await binary.fetch('/', 'chromedriver');
      assert(result);
      assert(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === '97.0.4692.71/') {
          assert(/^\d{4}\-\d{2}\-\d{2}T\d{2}:00:00Z$/.test(item.date));
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'LATEST_RELEASE_70.0.3538') {
          assert(item.date === '2018-11-06T07:19:08.413Z');
          assert(item.size === 12);
          assert(item.url === 'https://chromedriver.storage.googleapis.com/LATEST_RELEASE_70.0.3538');
          matchFile = true;
        }
      }
      assert(matchDir);
      assert(matchFile);
    });

    it('should fetch subdir: /97.0.4692.71/ work', async () => {
      app.mockHttpclient('https://chromedriver.storage.googleapis.com/', 'GET', {
        data: await TestUtil.readFixturesFile('chromedriver.storage.googleapis.com/97.0.4692.71.xml'),
        persist: false,
      });
      const result = await binary.fetch('/97.0.4692.71/', 'chromedriver');
      assert(result);
      assert(result.items.length > 0);
      let matchFile = false;
      for (const item of result.items) {
        assert(item.isDir === false);
        assert(typeof item.size === 'number');
        assert(item.size > 2);
        // console.log(item);
        if (item.name === 'chromedriver_mac64_m1.zip') {
          assert(item.date === '2022-01-05T05:45:15.397Z');
          assert(item.size === 7846919);
          assert(item.url === 'https://chromedriver.storage.googleapis.com/97.0.4692.71/chromedriver_mac64_m1.zip');
          matchFile = true;
        }
      }
      assert(matchFile);
    });

    it('should ignore dir with size = 0', async () => {
      app.mockHttpclient('https://selenium-release.storage.googleapis.com/', 'GET', {
        data: await TestUtil.readFixturesFile('selenium-release.storage.googleapis.com/2.43.xml'),
        persist: false,
      });
      // https://selenium-release.storage.googleapis.com/?delimiter=/&prefix=2.43/
      const result = await binary.fetch('/2.43/', 'selenium');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name !== '2.43');
      }
    });

    it('should ignore AWSLogs/', async () => {
      app.mockHttpclient('https://node-inspector.s3.amazonaws.com/', 'GET', {
        data: await TestUtil.readFixturesFile('node-inspector.s3.amazonaws.com/index.xml'),
        persist: false,
      });
      const result = await binary.fetch('/', 'node-inspector');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name !== 'AWSLogs/');
      }
    });
  });
});
