import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackageSearchService } from '../../../app/core/service/PackageSearchService.ts';
import type { SearchManifestType } from '../../../app/repository/SearchRepository.ts';
import { SearchRepository } from '../../../app/repository/SearchRepository.ts';
import { mockES } from '../../../config/config.unittest.ts';
import { TestUtil } from '../../../test/TestUtil.ts';

describe('test/core/service/PackageSearchService.test.ts', () => {
  let packageSearchService: PackageSearchService;
  let searchRepository: SearchRepository;

  beforeEach(async () => {
    mock(app.config.cnpmcore, 'enableElasticsearch', true);
    mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
    packageSearchService = await app.getEggObject(PackageSearchService);
    searchRepository = await app.getEggObject(SearchRepository);
  });

  afterEach(async () => {
    mockES.clearAll();
    mock.restore();
  });

  it('should sync package', async () => {
    const { pkg } = await TestUtil.createPackage({ isPrivate: true });
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      assert.equal(document.package.name, pkg.name);
      return document.package._rev;
    });
    const rev = await packageSearchService.syncPackage(pkg.name, true);
    assert(rev);
  });

  it('should sync package with deprecated field in document', async () => {
    const { pkg } = await TestUtil.createPackage({ isPrivate: true });
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      assert.equal(document.package.name, pkg.name);
      // non-deprecated package should not have deprecated field set
      assert.equal(document.package.deprecated, undefined);
      return document.package._rev;
    });
    const rev = await packageSearchService.syncPackage(pkg.name, true);
    assert(rev);
  });

  describe('searchPackage() with ES mock', () => {
    it('should filter deprecated packages by default (must_not exists query)', async () => {
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody, 'ES query body should be captured');
      const boolQuery = capturedBody.query.function_score.query.bool;
      // must_not should contain exists filter for deprecated field
      assert(boolQuery.must_not, 'must_not should be present');
      assert.equal(boolQuery.must_not.length, 1);
      assert.deepEqual(boolQuery.must_not[0], {
        exists: { field: 'package.deprecated' },
      });
      // no filter by default (searchPublishMinDuration is empty)
      assert.equal(boolQuery.filter, undefined);
    });

    it('should not add must_not when searchFilterDeprecated is false', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', false);
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert.equal(boolQuery.must_not, undefined, 'must_not should not be present');
    });

    it('should add range filter when searchPublishMinDuration is set to 2w', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '2w');
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      const before = Date.now();
      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert(boolQuery.filter, 'filter should be present');
      assert.equal(boolQuery.filter.length, 1);
      const rangeFilter = boolQuery.filter[0];
      assert(rangeFilter.range, 'should be a range query');
      assert(rangeFilter.range['package.date'], 'should filter on package.date');
      const lte = rangeFilter.range['package.date'].lte;
      assert(lte, 'lte should be set');
      // Verify cutoff is approximately 2 weeks ago
      const cutoff = new Date(lte).getTime();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(cutoff - (before - twoWeeksMs));
      assert(diff < 2000, `cutoff should be ~2 weeks ago, diff=${diff}ms`);
    });

    it('should add range filter for 1h duration', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '1h');
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      const before = Date.now();
      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert(boolQuery.filter);
      const cutoff = new Date(boolQuery.filter[0].range['package.date'].lte).getTime();
      const oneHourMs = 60 * 60 * 1000;
      const diff = Math.abs(cutoff - (before - oneHourMs));
      assert(diff < 2000, `cutoff should be ~1 hour ago, diff=${diff}ms`);
    });

    it('should add range filter for 7d duration', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '7d');
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      const before = Date.now();
      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert(boolQuery.filter);
      const cutoff = new Date(boolQuery.filter[0].range['package.date'].lte).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(cutoff - (before - sevenDaysMs));
      assert(diff < 2000, `cutoff should be ~7 days ago, diff=${diff}ms`);
    });

    it('should not add filter for invalid duration format', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', 'invalid');
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('test-pkg', 0, 10);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      assert.equal(boolQuery.filter, undefined, 'filter should not be present for invalid duration');
    });

    it('should combine deprecated filter and publish duration filter', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', true);
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '1w');
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('react', 0, 20);
      assert(capturedBody);
      const boolQuery = capturedBody.query.function_score.query.bool;
      // Both must_not and filter should be present
      assert(boolQuery.must_not, 'must_not should be present');
      assert.deepEqual(boolQuery.must_not[0], {
        exists: { field: 'package.deprecated' },
      });
      assert(boolQuery.filter, 'filter should be present');
      assert(boolQuery.filter[0].range['package.date'].lte);
      // should queries (match queries) should still be present
      assert(boolQuery.should.length > 0, 'should queries for text matching should be present');
    });

    it('should return search results with deprecated packages filtered out', async () => {
      const nonDeprecatedPkg = {
        package: {
          name: 'active-pkg',
          version: '1.0.0',
          description: 'An active package',
        },
        downloads: { all: 100 },
      };

      mockES.add(
        {
          method: 'POST',
          path: '/cnpmcore_packages/_search',
        },
        () => {
          // Simulate ES returning only non-deprecated results
          // (ES would filter out deprecated ones based on our must_not query)
          return {
            hits: {
              total: { value: 1, relation: 'eq' },
              hits: [{ _source: nonDeprecatedPkg }],
            },
          };
        },
      );

      const result = await packageSearchService.searchPackage('pkg', 0, 10);
      assert.equal(result.total, 1);
      assert.equal(result.objects.length, 1);
      assert.equal(result.objects[0]?.package.name, 'active-pkg');
    });

    it('should pass correct size and from to ES query', async () => {
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
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        },
      );

      await packageSearchService.searchPackage('test', 5, 20);
      assert(capturedBody);
      assert.equal(capturedBody.size, 20);
      assert.equal(capturedBody.from, 5);
    });
  });
});
