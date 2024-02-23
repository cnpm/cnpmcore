import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ChromeForTestingBinary } from '../../../../app/common/adapter/binary/ChromeForTestingBinary';
import { TestUtil } from '../../../../test/TestUtil';

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
