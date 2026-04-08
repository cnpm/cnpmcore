import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { EdgedriverBinary } from '../../../../app/common/adapter/binary/EdgedriverBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/EdgedriverBinary.test.ts', () => {
  let binary: EdgedriverBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(EdgedriverBinary);
  });

  describe('fetch()', () => {
    it('should work', async () => {
      app.mockHttpclient('https://edgeupdates.microsoft.com/api/products', 'GET', {
        data: await TestUtil.readFixturesFile('edgeupdates.json'),
        persist: false,
      });
      app.mockHttpclient('https://msedgedriver.microsoft.com/listing.json', 'GET', {
        data: await TestUtil.readFixturesFile('msedgedriver-listing.json'),
        persist: false,
      });
      let result = await binary.fetch('/');
      assert.deepEqual(result, {
        items: [
          {
            name: '124.0.2478.97/',
            date: '2024-05-11T06:47:00',
            size: '-',
            isDir: true,
            url: '',
          },
          {
            name: '125.0.2535.37/',
            date: '2024-05-10T18:52:00',
            size: '-',
            isDir: true,
            url: '',
          },
          {
            name: '126.0.2566.1/',
            date: '2024-05-07T17:30:00',
            size: '-',
            isDir: true,
            url: '',
          },
          {
            name: '126.0.2578.0/',
            date: '2024-05-10T16:33:00',
            size: '-',
            isDir: true,
            url: '',
          },
        ],
        nextParams: null,
      });

      const latestVersion = result.items[result.items.length - 1].name;
      assert.ok(latestVersion);
      assert.equal(latestVersion, '126.0.2578.0/');
      result = await binary.fetch(`/${latestVersion}`);
      assert.ok(result);
      const items = result.items;
      assert.ok(items.length >= 3);
      for (const item of items) {
        // {
        //   name: 'edgedriver_win64.zip',
        //   isDir: false,
        //   url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_win64.zip',
        //   size: 9564395,
        //   date: '2024-05-10T17:04:10+00:00'
        // }
        assert.equal(item.isDir, false);
        assert.match(item.name, /^edgedriver_[\w]+\.zip$/);
        assert.match(item.url, /^https:\/\/msedgedriver\.microsoft\.com\//);
        assert.ok(typeof item.size === 'number');
        assert.ok(item.size > 0);
        assert.ok(item.date);
      }
    });

    it('should return undefined when listing.json request fails', async () => {
      app.mockHttpclient('https://edgeupdates.microsoft.com/api/products', 'GET', {
        data: await TestUtil.readFixturesFile('edgeupdates.json'),
        persist: false,
      });
      app.mockHttpclient('https://msedgedriver.microsoft.com/listing.json', 'GET', {
        data: '',
        status: 500,
        persist: false,
      });
      const result = await binary.fetch('/126.0.2578.0/');
      assert.equal(result, undefined);
    });

    it('should cache listing.json across multiple sub-dir fetches', async () => {
      app.mockHttpclient('https://edgeupdates.microsoft.com/api/products', 'GET', {
        data: await TestUtil.readFixturesFile('edgeupdates.json'),
        persist: false,
      });
      let listingCalls = 0;
      const listingBuffer = await TestUtil.readFixturesFile('msedgedriver-listing.json');
      app.mockHttpclient('https://msedgedriver.microsoft.com/listing.json', 'GET', () => {
        listingCalls++;
        return { data: listingBuffer, status: 200 };
      });
      // First sub-dir fetch triggers the network request.
      const r1 = await binary.fetch('/126.0.2578.0/');
      assert.ok(r1);
      assert.ok(r1.items.length >= 3);
      // Second sub-dir fetch should hit the cached listing, no extra request.
      const r2 = await binary.fetch('/126.0.2578.0/');
      assert.ok(r2);
      assert.deepEqual(r2.items, r1.items);
      assert.equal(listingCalls, 1);
    });
  });
});
