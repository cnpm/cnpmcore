import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackageManagerService } from '../../app/core/service/PackageManagerService.ts';
import { PackageSearchService } from '../../app/core/service/PackageSearchService.ts';
import { SearchRepository, type SearchManifestType } from '../../app/repository/SearchRepository.ts';
import { mockES } from '../../config/config.unittest.ts';
import { TestUtil } from '../TestUtil.ts';

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
        },
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
        },
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
        },
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
        },
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

      mock(PackageSearchService.prototype, 'removePackage', async (fullname: string) => {
        if (fullname === '@cnpm/example') {
          called = true;
        }
      });

      await packageManagerService.blockPackageByFullname('@cnpm/example', 'test');
      if (!called) {
        // oxlint-disable-next-line no-console
        console.warn('called not called');
      }
    });
  });

  describe('search with deprecated filter', () => {
    let packageSearchService: PackageSearchService;

    beforeEach(async () => {
      packageSearchService = await app.getEggObject(PackageSearchService);
    });

    function createMockSource(name: string, options?: { deprecated?: string; date?: string }) {
      return {
        package: {
          name,
          version: '1.0.0',
          description: `${name} package`,
          ...(options?.deprecated ? { deprecated: options.deprecated } : {}),
          date: options?.date || new Date().toISOString(),
        },
        downloads: { all: 100 },
      };
    }

    it('should include must_not exists query for deprecated field by default', async () => {
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedBody: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: { body: unknown }) => {
          capturedBody = params.body;
          // Return only non-deprecated package
          return {
            hits: {
              total: { value: 1, relation: 'eq' },
              hits: [{ _source: createMockSource('active-pkg') }],
            },
          };
        },
      );

      const result = await packageSearchService.searchPackage('pkg', 0, 10);
      assert.equal(result.total, 1);
      assert.equal(result.objects[0]?.package.name, 'active-pkg');

      // Verify the ES query includes must_not for deprecated
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert(boolQuery.must_not, 'must_not should be present in ES query');
      assert.deepEqual(boolQuery.must_not[0], {
        exists: { field: 'package.deprecated' },
      });
    });

    it('should not include must_not query when searchFilterDeprecated is disabled', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', false);

      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedBody: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: { body: unknown }) => {
          capturedBody = params.body;
          // Return both deprecated and non-deprecated
          return {
            hits: {
              total: { value: 2, relation: 'eq' },
              hits: [
                { _source: createMockSource('active-pkg') },
                { _source: createMockSource('old-pkg', { deprecated: 'use active-pkg instead' }) },
              ],
            },
          };
        },
      );

      const result = await packageSearchService.searchPackage('pkg', 0, 10);
      assert.equal(result.total, 2);

      // Verify must_not is NOT in the query
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert.equal(boolQuery.must_not, undefined, 'must_not should not be present');
    });

    it('should include range filter on package.date when searchPublishMinDuration is set', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '2w');

      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedBody: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: { body: unknown }) => {
          capturedBody = params.body;
          return {
            hits: {
              total: { value: 1, relation: 'eq' },
              hits: [
                {
                  _source: createMockSource('old-pkg', {
                    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  }),
                },
              ],
            },
          };
        },
      );

      const before = Date.now();
      const result = await packageSearchService.searchPackage('pkg', 0, 10);
      assert.equal(result.total, 1);
      assert.equal(result.objects[0]?.package.name, 'old-pkg');

      // Verify range filter is in the query
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert(boolQuery.filter, 'filter should be present');
      assert.equal(boolQuery.filter.length, 1);
      const rangeFilter = boolQuery.filter[0];
      assert(rangeFilter.range['package.date'], 'should filter on package.date');
      const cutoff = new Date(rangeFilter.range['package.date'].lte).getTime();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      assert(Math.abs(cutoff - (before - twoWeeksMs)) < 2000, 'cutoff should be ~2 weeks ago');
    });

    it('should combine both deprecated and duration filters', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', true);
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '1d');

      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedBody: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: { body: unknown }) => {
          capturedBody = params.body;
          return {
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('test', 0, 20);

      const boolQuery = capturedBody.query.function_score.query.bool;
      // Both must_not and filter should coexist
      assert(boolQuery.must_not, 'must_not should be present');
      assert.equal(boolQuery.must_not.length, 1);
      assert.deepEqual(boolQuery.must_not[0], {
        exists: { field: 'package.deprecated' },
      });
      assert(boolQuery.filter, 'filter should be present');
      assert.equal(boolQuery.filter.length, 1);
      assert(boolQuery.filter[0].range['package.date'].lte, 'range lte should be set');
      // should queries should still work
      assert(boolQuery.should.length > 0, 'text match queries should still be present');
      assert.equal(boolQuery.minimum_should_match, 1);
    });

    it('should sync package with deprecated field into search document', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: true });

      let upsertedDoc: SearchManifestType | undefined;
      mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
        upsertedDoc = document;
        return document.package.name;
      });

      await packageSearchService.syncPackage(pkg.name, true);
      assert(upsertedDoc, 'document should be upserted to ES');
      assert.equal(upsertedDoc.package.name, pkg.name);
      // Non-deprecated package should not have deprecated field
      assert.equal(upsertedDoc.package.deprecated, undefined);
    });

    it('should handle duration formats: 1h, 7d, 1w', async () => {
      const cases = [
        { duration: '1h', expectedMs: 60 * 60 * 1000 },
        { duration: '7d', expectedMs: 7 * 24 * 60 * 60 * 1000 },
        { duration: '1w', expectedMs: 7 * 24 * 60 * 60 * 1000 },
      ];

      for (const { duration, expectedMs } of cases) {
        mockES.clearAll();
        mock.restore();
        mock(app.config.cnpmcore, 'enableElasticsearch', true);
        mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
        mock(app.config.cnpmcore, 'searchPublishMinDuration', duration);
        packageSearchService = await app.getEggObject(PackageSearchService);

        // oxlint-disable-next-line typescript-eslint/no-explicit-any
        let capturedBody: any;
        mockES.add(
          {
            method: 'POST',
            path: '/cnpmcore_packages/_search',
          },
          (params: { body: unknown }) => {
            capturedBody = params.body;
            return {
              hits: { total: { value: 0, relation: 'eq' }, hits: [] },
            };
          },
        );

        const before = Date.now();
        await packageSearchService.searchPackage('x', 0, 10);
        const cutoff = new Date(
          capturedBody.query.function_score.query.bool.filter[0].range['package.date'].lte,
        ).getTime();
        const diff = Math.abs(cutoff - (before - expectedMs));
        assert(diff < 2000, `${duration}: cutoff diff=${diff}ms should be < 2000ms`);
      }
    });

    it('should ignore invalid duration format and not add filter', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', 'abc');

      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedBody: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: { body: unknown }) => {
          capturedBody = params.body;
          return {
            hits: { total: { value: 0, relation: 'eq' }, hits: [] },
          };
        },
      );

      await packageSearchService.searchPackage('test', 0, 10);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert.equal(boolQuery.filter, undefined, 'invalid duration should not produce a filter');
    });
  });
});
