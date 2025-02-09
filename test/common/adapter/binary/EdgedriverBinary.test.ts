import { strict as assert } from 'node:assert';
import { app } from '@eggjs/mock/bootstrap';
import { EdgedriverBinary } from '../../../../app/common/adapter/binary/EdgedriverBinary';
import { TestUtil } from '../../../../test/TestUtil';

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

      const latestVersion = result!.items![result!.items.length - 1].name;
      assert(latestVersion);
      assert.equal(latestVersion, '126.0.2578.0/');
      result = await binary.fetch(`/${latestVersion}`);
      const items = result!.items;
      assert(items.length >= 3);
      for (const item of items) {
        // {
        //   name: 'edgedriver_win64.zip',
        //   isDir: false,
        //   url: 'https://msedgewebdriverstorage.blob.core.windows.net/edgewebdriver/126.0.2578.0/edgedriver_win64.zip',
        //   size: 9564395,
        //   date: 'Fri, 10 May 2024 17:04:10 GMT'
        // }
        assert.equal(item.isDir, false);
        assert.match(item.name, /^edgedriver_\w+.zip$/);
        assert.match(item.url, /^https:\/\//);
        assert(typeof item.size === 'number');
        assert(item.size > 0);
        assert(item.date);
      }
    });
  });
});
