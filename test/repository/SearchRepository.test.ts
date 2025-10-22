import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import {
  SearchRepository,
  type SearchManifestType,
} from '../../app/repository/SearchRepository.ts';
import { mockES } from '../../config/config.unittest.ts';
import { PackageManagerService } from '../../app/core/service/PackageManagerService.ts';
import { TestUtil } from '../TestUtil.ts';
import { PackageSearchService } from '../../app/core/service/PackageSearchService.ts';

describe('test/repository/SearchRepository.test.ts', () => {
  let searchRepository: SearchRepository;
  let packageManagerService: PackageManagerService;

  beforeEach(async () => {
    mock(app.config.cnpmcore, 'enableElasticsearch', true);
    mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
    searchRepository = await app.getEggObject(SearchRepository);
    packageManagerService = await app.getEggObject(PackageManagerService);
  });

  afterEach(async () => {
    mockES.clearAll();
    mock.restore();
  });

  describe('SearchRepository', () => {
    it('search work', async () => {
      const _source = {
        downloads: {
          all: 0,
        },
        package: {
          name: 'example',
          description: 'example package',
        },
      };
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        () => {
          return {
            hits: {
              total: { value: 1, relation: 'eq' },
              hits: [
                {
                  _source,
                },
              ],
            },
          };
        }
      );
      const res = await searchRepository.searchPackage({
        body: {
          query: {
            match: {
              'package.name': 'example',
            },
          },
        },
      });
      assert.deepEqual(res.hits[0]._source, _source);
    });

    it('upsert work', async () => {
      const manifest: SearchManifestType = {
        package: {
          name: 'example',
          'dist-tags': {
            latest: '1.0.0',
          },
          scope: 'unscoped',
          version: '1.0.0',
          _rev: '243-61f144324ce7cf8f58255946"',
          versions: ['1.0.1'],
          maintainers: [
            {
              name: 'cnpmcore',
              email: 'cnpmcore@example.com',
            },
          ],
          author: {
            name: 'cnpmcore',
            email: 'cnpmcore@example.com',
          },
          date: new Date(),
          created: new Date(),
          modified: new Date(),
        },
        downloads: {
          all: 0,
        },
      };
      mockES.add(
        {
          method: 'PUT',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        () => {
          return {
            _id: manifest.package.name,
          };
        }
      );
      const id = await searchRepository.upsertPackage(manifest);
      assert.equal(id, manifest.package.name);
    });

    it('delete work', async () => {
      const mockedPackageName = 'example';
      mockES.add(
        {
          method: 'DELETE',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        () => {
          return {
            _id: 'example',
          };
        }
      );
      const id = await searchRepository.removePackage(mockedPackageName);
      assert.equal(id, mockedPackageName);
    });

    it('should clear blocked pkg', async () => {
      await TestUtil.createPackage({
        name: '@cnpm/example',
      });

      const _source = {
        downloads: {
          all: 0,
        },
        package: {
          name: '@cnpm/example',
          description: 'example package',
        },
      };

      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        () => {
          return {
            hits: {
              total: { value: 1, relation: 'eq' },
              hits: [
                {
                  _source,
                },
              ],
            },
          };
        }
      );

      let res = await searchRepository.searchPackage({
        body: {
          query: {
            match: {
              'package.name': '@cnpm/example',
            },
          },
        },
      });

      assert.deepEqual(res.hits.length, 1);

      res = await searchRepository.searchPackage({
        body: {
          query: {
            match: {
              'package.name': '@cnpm/example',
            },
          },
        },
      });

      let called = false;

      mock(
        PackageSearchService.prototype,
        'removePackage',
        async (fullname: string) => {
          if (fullname === '@cnpm/example') {
            called = true;
          }
        }
      );

      await packageManagerService.blockPackageByFullname(
        '@cnpm/example',
        'test'
      );
      if (!called) {
        // oxlint-disable-next-line no-console
        console.warn('called not called');
      }
    });
  });
});
