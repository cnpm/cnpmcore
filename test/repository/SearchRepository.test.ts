import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { SearchManifestType, SearchRepository } from '../../app/repository/SearchRepository';
import { mockES } from '../../config/config.unittest';

describe('test/repository/SearchRepository.test.ts', () => {
  let searchRepository: SearchRepository;

  beforeEach(async () => {
    mock(app.config.cnpmcore, 'enableElasticsearch', true);
    mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
    searchRepository = await app.getEggObject(SearchRepository);
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
      mockES.add({
        method: 'POST',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
      }, () => {
        return {
          hits: {
            total: { value: 1, relation: 'eq' },
            hits: [{
              _source,
            }],
          },
        };
      });
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
          versions: [ '1.0.1' ],
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
      mockES.add({
        method: 'PUT',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
      }, () => {
        return {
          _id: manifest.package.name,
        };
      });
      const id = await searchRepository.upsertPackage(manifest);
      assert.equal(id, manifest.package.name);
    });

    it('delete work', async () => {
      const mockedPackageName = 'example';
      mockES.add({
        method: 'DELETE',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
      }, () => {
        return {
          _id: 'example',
        };
      });
      const id = await searchRepository.removePackage(mockedPackageName);
      assert.equal(id, mockedPackageName);
    });
  });
});
