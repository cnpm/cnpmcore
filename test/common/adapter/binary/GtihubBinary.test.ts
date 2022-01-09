import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { GithubBinary } from 'app/common/adapter/binary/GithubBinary';
import { TestUtil } from 'test/TestUtil';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/GithubBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root and subdir work', async () => {
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('electron-releases.json'));
      app.mockHttpclient('https://api.github.com/repos/electron/electron/releases', 'GET', {
        data: response,
        status: 200,
      });
      const binary = new GithubBinary(ctx.httpclient, ctx.logger, binaries.electron);
      let result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      for (const item of result.items) {
        assert(item.name.endsWith('/'));
        assert(item.isDir);
        assert(item.size === '-');
      }

      const firstDir = `/${result.items[0].name}`;
      result = await binary.fetch(firstDir);
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
