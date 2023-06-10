import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { GithubBinary } from '../../../../app/common/adapter/binary/GithubBinary';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/common/adapter/binary/GithubBinary.test.ts', () => {
  let binary: GithubBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(GithubBinary);
  });
  describe('fetch()', () => {
    it('should fetch root and subdir work', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });
      let result = await binary.fetch('/', 'electron');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name.endsWith('/'));
        assert(item.isDir);
        assert(item.size === '-');
      }

      const firstDir = `/${result.items[0].name}`;
      result = await binary.fetch(firstDir, 'electron');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(!item.name.endsWith('/'));
        assert(!item.isDir);
      }
      // console.log(result.items);
    });
  });
});
