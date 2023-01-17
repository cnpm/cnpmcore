import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ElectronBinary } from 'app/common/adapter/binary/ElectronBinary';
import { TestUtil } from 'test/TestUtil';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/ElectronBinary.test.ts', () => {
  describe('fetch()', () => {
    it('should fetch root and subdir work', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient(/https:\/\/api\.github\.com\/repos\/electron\/electron\/releases/, 'GET', {
        data: response,
        status: 200,
      });
      const binary = new ElectronBinary(app.httpclient, app.logger, binaries.electron, 'electron');
      let result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      // console.log(result.items);
      for (const item of result.items) {
        assert(item.name.endsWith('/'));
        assert(item.isDir);
        assert(item.size === '-');
      }

      const firstDir = result.items[0].name;
      const secondDir = result.items[1].name;
      assert(firstDir === `v${secondDir}`);
      result = await binary.fetch(`/${firstDir}`);
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(!item.name.endsWith('/'));
        assert(!item.isDir);
      }
      const firstItemsLength = result.items.length;
      // console.log(result.items);

      result = await binary.fetch(`/${secondDir}`);
      assert(result);
      assert(result.items.length === firstItemsLength);
      for (const item of result.items) {
        assert(!item.name.endsWith('/'));
        assert(!item.isDir);
      }
      // console.log(result.items);
    });
  });
});
