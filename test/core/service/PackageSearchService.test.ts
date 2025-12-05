import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { PackageSearchService } from '../../../app/core/service/PackageSearchService.ts';
import { SearchManifestType, SearchRepository } from '../../../app/repository/SearchRepository.ts';
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
});
