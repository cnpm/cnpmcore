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

  it('should include links with npm url mapped to npmx.dev', async () => {
    const { pkg } = await TestUtil.createPackage({ isPrivate: true });
    let savedDocument: SearchManifestType | undefined;
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      savedDocument = document;
      return document.package._rev;
    });
    await packageSearchService.syncPackage(pkg.name, true);
    assert(savedDocument);
    assert(savedDocument.package.links);
    assert.equal(savedDocument.package.links.npm, `https://npmx.dev/package/${pkg.name}`);
  });

  it('should include homepage, repository, and bugs in links when available', async () => {
    const name = '@cnpm/testmodule-search-links';
    const pkg = await TestUtil.getFullPackage({
      name,
      version: '1.0.0',
      versionObject: {
        homepage: 'https://example.com',
        repository: { type: 'git', url: 'https://github.com/example/repo' },
        bugs: { url: 'https://github.com/example/repo/issues' },
      },
    });

    const { authorization, ua } = await TestUtil.createUser();
    await app.httpRequest()
      .put(`/${name}`)
      .set('authorization', authorization)
      .set('user-agent', ua)
      .send(pkg)
      .expect(201);

    let savedDocument: SearchManifestType | undefined;
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      savedDocument = document;
      return document.package._rev;
    });
    await packageSearchService.syncPackage(name, true);
    assert(savedDocument);
    assert(savedDocument.package.links);
    assert.equal(savedDocument.package.links.npm, `https://npmx.dev/package/${name}`);
    assert.equal(savedDocument.package.links.homepage, 'https://example.com');
    assert.equal(savedDocument.package.links.repository, 'https://github.com/example/repo');
    assert.equal(savedDocument.package.links.bugs, 'https://github.com/example/repo/issues');
  });

  it('should use custom npmWebUrl from config', async () => {
    mock(app.config.cnpmcore, 'npmWebUrl', 'https://custom.example.com');
    const { pkg } = await TestUtil.createPackage({ isPrivate: true });
    let savedDocument: SearchManifestType | undefined;
    mock(searchRepository, 'upsertPackage', async (document: SearchManifestType) => {
      savedDocument = document;
      return document.package._rev;
    });
    await packageSearchService.syncPackage(pkg.name, true);
    assert(savedDocument);
    assert(savedDocument.package.links);
    assert.equal(savedDocument.package.links.npm, `https://custom.example.com/package/${pkg.name}`);
  });
});
