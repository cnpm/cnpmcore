import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { ApiBinary } from '../../../../app/common/adapter/binary/ApiBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/ApiBinary.test.ts', () => {
  let binary: ApiBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(ApiBinary);
  });
  describe('fetch()', () => {
    it('should fetch root: / work', async () => {
      mock(app.config.cnpmcore, 'syncBinaryFromAPISource', 'https://cnpmjs.org/mirrors/apis');
      app.mockHttpclient('https://cnpmjs.org/mirrors/apis/node/', 'GET', {
        data: await TestUtil.readFixturesFile('cnpmjs.org/mirrors/apis/node.json'),
        persist: false,
      });
      const result = await binary.fetch('/', 'node');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'v0.10.40/') {
          assert.ok(item.date === '09-Jul-2015 21:57');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'node-v0.1.100.tar.gz') {
          assert.ok(item.date === '26-Aug-2011 16:21');
          assert.ok(item.isDir === false);
          assert.ok(item.size === 3_813_493);
          assert.ok(item.url === 'https://r.cnpmjs.org/-/binary/node/node-v0.1.100.tar.gz');
          matchFile = true;
        }
        if (!item.isDir) {
          assert.ok(typeof item.size === 'number');
          assert.ok(item.size > 0);
        }
      }
      assert.ok(matchDir);
      assert.ok(matchFile);
    });

    it('should fetch subdir: /v16.13.1/ work', async () => {
      mock(app.config.cnpmcore, 'syncBinaryFromAPISource', null);
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      app.mockHttpclient('https://r.cnpmjs.org/-/binary/node/v16.13.1/', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/-/binary/node/v16.13.1.json'),
        persist: false,
      });
      const result = await binary.fetch('/v16.13.1/', 'node');
      assert.ok(result);
      assert.ok(result.items.length > 0);
      let matchDir = false;
      let matchFile = false;
      for (const item of result.items) {
        if (item.name === 'docs/') {
          assert.ok(item.date === '30-Nov-2021 19:33');
          assert.ok(item.isDir === true);
          assert.ok(item.size === '-');
          matchDir = true;
        }
        if (item.name === 'SHASUMS256.txt') {
          assert.ok(item.date === '01-Dec-2021 16:13');
          assert.ok(item.isDir === false);
          assert.ok(item.size === 3153);
          assert.ok(item.url === 'https://r.cnpmjs.org/-/binary/node/v16.13.1/SHASUMS256.txt');
          matchFile = true;
        }
        if (!item.isDir) {
          assert.ok(typeof item.size === 'number');
          assert.ok(item.size > 0);
        }
      }
      assert.ok(matchDir);
      assert.ok(matchFile);
    });

    it('should fetch with lastData', async () => {
      mock(app.config.cnpmcore, 'syncBinaryFromAPISource', 'https://cnpmjs.org/mirrors/apis');
      app.mockHttpclient('https://cnpmjs.org/mirrors/apis/node/', 'GET', {
        data: await TestUtil.readFixturesFile('cnpmjs.org/mirrors/apis/node.json'),
        persist: false,
      });
      const result = await binary.fetch('/', 'node', {
        lastSyncTime: '2025-03-11T15:43:56.748Z',
      });
      assert.ok(result);
      assert.ok(result.items.length > 0);
    });
  });
});
