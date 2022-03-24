import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { CypressBinary } from 'app/common/adapter/binary/CypressBinary';
import binaries from 'config/binaries';

describe('test/common/adapter/binary/CypressBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      const binary = new CypressBinary(ctx.httpclient, ctx.logger, binaries.cypress);
      const result = await binary.fetch('/');
      assert(result);
      assert(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === '4.0.0/') {
          assert(item.date === '2020-02-06T19:40:50.366Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === '9.2.0/') {
          assert(item.date === '2021-12-21T16:13:41.383Z');
          assert(item.isDir === true);
          assert(item.size === '-');
          matchDir2 = true;
        }
      }
      assert(matchDir1);
      assert(matchDir2);
    });

    it('should fetch subdir: /4.0.0/, /4.0.0/linux-x64/ work', async () => {
      const binary = new CypressBinary(ctx.httpclient, ctx.logger, binaries.cypress);
      let result = await binary.fetch('/4.0.0/');
      assert(result);
      assert(result.items.length === 3);
      assert(result.items[0].name === 'darwin-x64/');
      assert(result.items[1].name === 'linux-x64/');
      assert(result.items[2].name === 'win32-x64/');
      assert(result.items[0].isDir);

      result = await binary.fetch('/4.0.0/darwin-x64/');
      assert(result);
      assert(result.items.length === 1);
      assert(result.items[0].name === 'cypress.zip');
      assert(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/darwin-x64/cypress.zip');
      assert(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/linux-x64/');
      assert(result);
      assert(result.items.length === 1);
      assert(result.items[0].name === 'cypress.zip');
      assert(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/linux-x64/cypress.zip');
      assert(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/win32-x64/');
      assert(result);
      assert(result.items.length === 1);
      assert(result.items[0].name === 'cypress.zip');
      assert(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/win32-x64/cypress.zip');
      assert(!result.items[0].isDir);
    });
  });
});
