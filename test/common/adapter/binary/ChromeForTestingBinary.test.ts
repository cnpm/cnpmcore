import { strict as assert } from 'node:assert';
import { app } from '@eggjs/mock/bootstrap';

import { ChromeForTestingBinary } from '../../../../app/common/adapter/binary/ChromeForTestingBinary.js';
import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/common/adapter/binary/ChromeForTestingBinary.test.ts', () => {
  let binary: ChromeForTestingBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(ChromeForTestingBinary);
  });

  describe('fetch()', () => {
    it('should work for chrome binary', async () => {
      assert.equal(ChromeForTestingBinary.lastTimestamp, '');
      app.mockHttpclient('https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json', 'GET', {
        data: await TestUtil.readFixturesFile('chrome-for-testing/known-good-versions-with-downloads.json'),
        persist: false,
      });
      const result = await binary.fetch('/');
      assert.equal(result?.items[0].name, 'known-good-versions-with-downloads.json');
      assert.equal(result?.items[0].date, '2023-09-16T00:21:21.964Z');
      assert.equal(result?.items[0].isDir, false);
      assert.equal(result?.items[1].name, 'latest-patch-versions-per-build.json');
      assert.equal(result?.items[1].date, '2023-09-16T00:21:21.964Z');
      assert.equal(result?.items[1].isDir, false);
      assert.equal(result?.items[2].name, 'last-known-good-versions.json');
      assert.equal(result?.items[2].date, '2023-09-16T00:21:21.964Z');
      assert.equal(result?.items[2].isDir, false);
      const latestVersion = result!.items![result!.items.length - 1].name;
      assert(latestVersion);
      assert.equal(latestVersion, '119.0.6008.0/');

      const platformRes = await binary.fetch(`/${latestVersion}`);
      const platforms = platformRes?.items.map(item => item.name);
      assert(platforms);
      assert.deepEqual(platforms, [ 'linux64/', 'mac-arm64/', 'mac-x64/', 'win32/', 'win64/' ]);

      for (const platform of platforms) {
        const versionRes = await binary.fetch(`/${latestVersion}${platform}`);
        const versions = versionRes?.items.map(item => item.name);
        assert.equal(versions?.length, 3);
        assert(versionRes?.items[0].name);
        assert.equal(versionRes?.items[0].isDir, false);
        assert.match(versionRes?.items[0].name, /^chrome\-/);
        assert.match(versionRes?.items[1].name, /^chromedriver\-/);
        assert.match(versionRes?.items[2].name, /^chrome\-headless\-shell\-/);
      }
      await binary.finishFetch(true);
      assert(ChromeForTestingBinary.lastTimestamp);
    });

    it('should return empty when timestamp is not changed', async () => {
      assert(ChromeForTestingBinary.lastTimestamp);
      await binary.initFetch();
      app.mockHttpclient('https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json', 'GET', {
        data: await TestUtil.readFixturesFile('chrome-for-testing/known-good-versions-with-downloads.json'),
        persist: false,
      });
      const result = await binary.fetch('/');
      assert.equal(result?.items.length, 0);
    });
  });
});
