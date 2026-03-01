import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';
import type { estypes } from '@elastic/elasticsearch';

import { PackageSearchService } from '../../../app/core/service/PackageSearchService.ts';
import type { SearchManifestType } from '../../../app/repository/SearchRepository.ts';
import { SearchRepository } from '../../../app/repository/SearchRepository.ts';
import { TestUtil } from '../../../test/TestUtil.ts';

describe('test/core/service/PackageSearchService.test.ts', () => {
  let packageSearchService: PackageSearchService;
  let searchRepository: SearchRepository;

  beforeEach(async () => {
    packageSearchService = await app.getEggObject(PackageSearchService);
    searchRepository = await app.getEggObject(SearchRepository);
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

  it('should sync package with deprecated field', async () => {
    const { pkg } = await TestUtil.createPackage({ isPrivate: true });
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      assert.equal(document.package.name, pkg.name);
      // deprecated field should exist (undefined for non-deprecated packages)
      assert.equal(document.package.deprecated, undefined);
      return document.package._rev;
    });
    const rev = await packageSearchService.syncPackage(pkg.name, true);
    assert(rev);
  });

  describe('searchPackage()', () => {
    it('should filter deprecated packages by default', async () => {
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedQuery: any;
      mock(searchRepository, 'searchPackage', async (query: any) => {
        capturedQuery = query;
        return {
          hits: [],
          total: { value: 0, relation: 'eq' },
        } as estypes.SearchHitsMetadata<SearchManifestType>;
      });

      await packageSearchService.searchPackage('test', 0, 10);
      assert(capturedQuery);
      const boolQuery = capturedQuery.body.query.function_score.query.bool;
      assert(boolQuery.must_not);
      assert.equal(boolQuery.must_not.length, 1);
      assert.deepEqual(boolQuery.must_not[0], {
        exists: { field: 'package.deprecated' },
      });
    });

    it('should not filter deprecated packages when searchFilterDeprecated is false', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', false);
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedQuery: any;
      mock(searchRepository, 'searchPackage', async (query: any) => {
        capturedQuery = query;
        return {
          hits: [],
          total: { value: 0, relation: 'eq' },
        } as estypes.SearchHitsMetadata<SearchManifestType>;
      });

      await packageSearchService.searchPackage('test', 0, 10);
      assert(capturedQuery);
      const boolQuery = capturedQuery.body.query.function_score.query.bool;
      assert.equal(boolQuery.must_not, undefined);
    });

    it('should filter by publish min duration when configured', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', '2w');
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedQuery: any;
      mock(searchRepository, 'searchPackage', async (query: any) => {
        capturedQuery = query;
        return {
          hits: [],
          total: { value: 0, relation: 'eq' },
        } as estypes.SearchHitsMetadata<SearchManifestType>;
      });

      const before = Date.now();
      await packageSearchService.searchPackage('test', 0, 10);
      const after = Date.now();
      assert(capturedQuery);
      const boolQuery = capturedQuery.body.query.function_score.query.bool;
      assert(boolQuery.filter);
      assert.equal(boolQuery.filter.length, 1);
      const rangeFilter = boolQuery.filter[0].range['package.date'];
      assert(rangeFilter.lte);
      // cutoff should be approximately 2 weeks ago
      const cutoff = new Date(rangeFilter.lte).getTime();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      assert(cutoff >= before - twoWeeksMs - 1000);
      assert(cutoff <= after - twoWeeksMs + 1000);
    });

    it('should not filter by publish min duration when not configured', async () => {
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedQuery: any;
      mock(searchRepository, 'searchPackage', async (query: any) => {
        capturedQuery = query;
        return {
          hits: [],
          total: { value: 0, relation: 'eq' },
        } as estypes.SearchHitsMetadata<SearchManifestType>;
      });

      await packageSearchService.searchPackage('test', 0, 10);
      assert(capturedQuery);
      const boolQuery = capturedQuery.body.query.function_score.query.bool;
      assert.equal(boolQuery.filter, undefined);
    });

    it('should support duration formats: hours, days, weeks', async () => {
      const testCases = [
        { input: '1h', expectedMs: 60 * 60 * 1000 },
        { input: '24h', expectedMs: 24 * 60 * 60 * 1000 },
        { input: '1d', expectedMs: 24 * 60 * 60 * 1000 },
        { input: '7d', expectedMs: 7 * 24 * 60 * 60 * 1000 },
        { input: '1w', expectedMs: 7 * 24 * 60 * 60 * 1000 },
        { input: '2w', expectedMs: 14 * 24 * 60 * 60 * 1000 },
      ];

      for (const { input, expectedMs } of testCases) {
        mock.restore();
        packageSearchService = await app.getEggObject(PackageSearchService);
        searchRepository = await app.getEggObject(SearchRepository);
        mock(app.config.cnpmcore, 'searchPublishMinDuration', input);
        // oxlint-disable-next-line typescript-eslint/no-explicit-any
        let capturedQuery: any;
        mock(searchRepository, 'searchPackage', async (query: any) => {
          capturedQuery = query;
          return {
            hits: [],
            total: { value: 0, relation: 'eq' },
          } as estypes.SearchHitsMetadata<SearchManifestType>;
        });

        const before = Date.now();
        await packageSearchService.searchPackage('test', 0, 10);
        assert(capturedQuery, `query should be captured for ${input}`);
        const boolQuery = capturedQuery.body.query.function_score.query.bool;
        assert(boolQuery.filter, `filter should exist for ${input}`);
        const cutoff = new Date(boolQuery.filter[0].range['package.date'].lte).getTime();
        assert(Math.abs(cutoff - (before - expectedMs)) < 2000, `cutoff should be ~${expectedMs}ms ago for ${input}`);
      }
    });

    it('should ignore invalid duration format', async () => {
      mock(app.config.cnpmcore, 'searchPublishMinDuration', 'invalid');
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
      let capturedQuery: any;
      mock(searchRepository, 'searchPackage', async (query: any) => {
        capturedQuery = query;
        return {
          hits: [],
          total: { value: 0, relation: 'eq' },
        } as estypes.SearchHitsMetadata<SearchManifestType>;
      });

      await packageSearchService.searchPackage('test', 0, 10);
      assert(capturedQuery);
      const boolQuery = capturedQuery.body.query.function_score.query.bool;
      assert.equal(boolQuery.filter, undefined);
    });
  });
});
