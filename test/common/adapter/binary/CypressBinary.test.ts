import assert from 'node:assert';

import { app } from '@eggjs/mock/bootstrap';

import { CypressBinary } from '../../../../app/common/adapter/binary/CypressBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/CypressBinary.test.ts', () => {
  let binary: CypressBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(CypressBinary);
  });

  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/cypress', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/cypress.json'),
        persist: false,
      });
      const result = await binary.fetch('/');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir1 = false;
      let matchDir2 = false;
      for (const item of result.items) {
        if (item.name === '4.0.0/') {
          assert.ok(item.date === '2020-02-06T19:40:50.366Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir1 = true;
        }
        if (item.name === '9.2.0/') {
          assert.ok(item.date === '2021-12-21T16:13:41.383Z');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir2 = true;
        }
      }
      assert.ok(matchDir1);
      assert.ok(matchDir2);
    });

    it('should fetch subdir: /4.0.0/, /4.0.0/linux-x64/ work', async () => {
      app.mockHttpclient('https://registry.npmjs.com/cypress', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.com/cypress.json'),
        persist: false,
      });
      let result = await binary.fetch('/4.0.0/');
      assert.ok(result);
      assert.equal(result.items.length, 5);
      assert.equal(result.items[0].name, 'darwin-x64/');
      assert.equal(result.items[1].name, 'darwin-arm64/');
      assert.equal(result.items[2].name, 'linux-x64/');
      assert.equal(result.items[3].name, 'linux-arm64/');
      assert.equal(result.items[4].name, 'win32-x64/');
      assert.ok(result.items[0].isDir);

      result = await binary.fetch('/4.0.0/darwin-x64/');
      assert.ok(result);
      assert.ok(result.items.length === 1);
      assert.ok(result.items[0].name === 'cypress.zip');
      assert.ok(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/darwin-x64/cypress.zip');
      assert.ok(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/darwin-arm64/');
      assert.ok(result);
      assert.ok(result.items.length === 1);
      assert.ok(result.items[0].name === 'cypress.zip');
      assert.ok(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/darwin-arm64/cypress.zip');
      assert.ok(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/linux-x64/');
      assert.ok(result);
      assert.ok(result.items.length === 1);
      assert.ok(result.items[0].name === 'cypress.zip');
      assert.ok(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/linux-x64/cypress.zip');
      assert.ok(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/linux-arm64/');
      assert.ok(result);
      assert.ok(result.items.length === 1);
      assert.ok(result.items[0].name === 'cypress.zip');
      assert.ok(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/linux-arm64/cypress.zip');
      assert.ok(!result.items[0].isDir);

      result = await binary.fetch('/4.0.0/win32-x64/');
      assert.ok(result);
      assert.ok(result.items.length === 1);
      assert.ok(result.items[0].name === 'cypress.zip');
      assert.ok(result.items[0].url === 'https://cdn.cypress.io/desktop/4.0.0/win32-x64/cypress.zip');
      assert.ok(!result.items[0].isDir);
    });
  });
});
