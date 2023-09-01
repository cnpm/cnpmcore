import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';

import { mockES } from '../../../../config/config.unittest';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/package/SearchPackageController.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    mock(app.config.cnpmcore, 'enableElasticsearch', true);
    mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
  });

  afterEach(async () => {
    mockES.clearAll();
    mock.restore();
  });

  describe('[GET /-/v1/search] search()', async () => {
    it('should throw 451 when enableElasticsearch is false', async () => {
      mock(app.config.cnpmcore, 'enableElasticsearch', false);
      await app.httpRequest()
        .get('/-/v1/search?text=example&from=0&size=1')
        .expect(451);
    });

    it('should get example package', async () => {
      mockES.add({
        method: 'POST',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
      }, () => {
        return {
          hits: {
            total: { value: 1, relation: 'eq' },
            hits: [{
              _source: {
                downloads: {
                  all: 0,
                },
                package: {
                  name: 'example',
                  description: 'example package',
                },
              },
            }],
          },
        };
      });
      const res = await app.httpRequest()
        .get('/-/v1/search?text=example&from=0&size=1');
      assert.equal(res.body.objects[0].package.name, 'example');
      assert.equal(res.body.total, 1);
    });

  });

  describe('[PUT /-/v1/search/sync/:fullname] sync()', async () => {
    it('should throw 451 when enableElasticsearch is false', async () => {
      mock(app.config.cnpmcore, 'enableElasticsearch', false);
      await app.httpRequest()
        .put('/-/v1/search/sync/example')
        .expect(451);
    });

    it('should upsert a example package', async () => {
      const name = 'testmodule-search-package';
      mockES.add({
        method: 'PUT',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
      }, () => {
        return {
          _id: name,
        };
      });
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');
      const pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .put(`/-/v1/search/sync/${name}`);
      assert.equal(res.body.package, name);
    });
  });

  describe('[DELETE /-/v1/search/sync/:fullname] delete()', async () => {
    let admin:Awaited<ReturnType<typeof TestUtil.createAdmin>>;
    beforeEach(async () => {
      admin = await TestUtil.createAdmin();
    });
    it('should throw 451 when enableElasticsearch is false', async () => {
      mock(app.config.cnpmcore, 'enableElasticsearch', false);
      await app.httpRequest()
        .delete('/-/v1/search/sync/example')
        .set('authorization', admin.authorization)
        .expect(451);
    });

    it('should delete a example package', async () => {
      const name = 'testmodule-search-package';
      mockES.add({
        method: 'DELETE',
        path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
      }, () => {
        return {
          _id: name,
        };
      });
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableElasticsearch', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');

      const res = await app.httpRequest()
        .delete(`/-/v1/search/sync/${name}`)
        .set('authorization', admin.authorization);
      assert.equal(res.body.package, name);
    });
  });
});
