import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { EdgedriverBinary } from '../../../../app/common/adapter/binary/EdgedriverBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/EdgedriverBinary.test.ts', () => {
  let binary: EdgedriverBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(EdgedriverBinary);
    // EdgedriverBinary is a @SingletonProto — reset its per-sync cache so
    // each test sees a fresh state (the first `fetch('/')` call populates
    // `dirItems` which would otherwise persist across tests).
    await binary.initFetch();
  });

  describe('fetch()', () => {
    it('should list recent stable versions from edgeupdates.microsoft.com', async () => {
      app.mockHttpclient('https://edgeupdates.microsoft.com/api/products', 'GET', {
        data: await TestUtil.readFixturesFile('edgeupdates.json'),
        persist: false,
      });
      const result = await binary.fetch('/');
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
    });

    it('should generate all known platform driver URLs for a version', async () => {
      app.mockHttpclient('https://edgeupdates.microsoft.com/api/products', 'GET', {
        data: await TestUtil.readFixturesFile('edgeupdates.json'),
        persist: false,
      });
      const result = await binary.fetch('/126.0.2578.0/');
      assert.ok(result);
      assert.equal(result.nextParams, null);
      // Expect all six known platform filenames, pointing at the new CDN,
      // with `ignoreDownloadStatuses: [404]` so older versions that don't
      // ship every platform get skipped cleanly instead of failing the sync.
      assert.deepEqual(result.items, [
        {
          name: 'edgedriver_arm64.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_arm64.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
        {
          name: 'edgedriver_linux64.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_linux64.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
        {
          name: 'edgedriver_mac64.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_mac64.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
        {
          name: 'edgedriver_mac64_m1.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_mac64_m1.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
        {
          name: 'edgedriver_win32.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_win32.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
        {
          name: 'edgedriver_win64.zip',
          isDir: false,
          url: 'https://msedgedriver.microsoft.com/126.0.2578.0/edgedriver_win64.zip',
          size: '-',
          date: '-',
          ignoreDownloadStatuses: [404],
        },
      ]);
    });
  });
});
