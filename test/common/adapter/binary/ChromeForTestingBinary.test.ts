import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ChromeForTestingBinary } from '../../../../app/common/adapter/binary/ChromeForTestingBinary';

describe('test/common/adapter/binary/ChromeForTestingBinary.test.ts', () => {
  let binary: ChromeForTestingBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(ChromeForTestingBinary);
  });
  describe('fetch()', () => {
    it('should work for chrome binary', async () => {
      const result = await binary.fetch('/');
      const latestVersion = result?.items?.[0].name;
      assert(latestVersion);

      const platformRes = await binary.fetch(`/${latestVersion}`);
      const platforms = platformRes?.items.map(item => item.name);
      assert(platforms);

      for (const platform of platforms) {
        const versionRes = await binary.fetch(`/${latestVersion}${platform}`);
        const versions = versionRes?.items.map(item => item.name);
        assert.equal(versions?.length, 1);
        assert(versionRes?.items[0].name);
        assert.equal(versionRes?.items[0].isDir, false);
      }
    });
  });
});
