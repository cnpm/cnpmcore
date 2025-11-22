import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';
import { errors } from '@elastic/elasticsearch';

import { mockES } from '../../../../config/config.unittest.ts';
import { TestUtil, type TestUser } from '../../../TestUtil.ts';

describe('test/port/controller/package/SearchPackageController.test.ts', () => {
  let publisher: TestUser;
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
      await app
        .httpRequest()
        .get('/-/v1/search?text=example&from=0&size=1')
        .expect(451);
    });

    it('should get example package', async () => {
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
                  _source: {
                    downloads: {
                      all: 0,
                    },
                    package: {
                      name: 'example',
                      description: 'example package',
                    },
                  },
                },
              ],
            },
          };
        }
      );
      const res = await app
        .httpRequest()
        .get('/-/v1/search?text=example&from=0&size=1');
      assert.equal(res.body.objects[0].package.name, 'example');
      assert.equal(res.body.total, 1);
    });

    it('should get example package when search text is empty', async () => {
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
                  _source: {
                    downloads: {
                      all: 0,
                    },
                    package: {
                      name: 'example',
                      description: 'example package',
                    },
                  },
                },
              ],
            },
          };
        }
      );
      const res = await app.httpRequest().get('/-/v1/search?from=0&size=1');
      assert.equal(res.body.objects[0].package.name, 'example');
      assert.equal(res.body.total, 1);
    });

    it('should filter deprecated packages by default', async () => {
      let capturedQuery: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: any) => {
          capturedQuery = params.body;
          return {
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        }
      );
      
      await app.httpRequest().get('/-/v1/search?text=example&from=0&size=1');
      
      // Verify that filter for deprecated packages is added
      assert.ok(capturedQuery);
      assert.ok(capturedQuery.query.function_score.query.bool.filter);
      const filters = capturedQuery.query.function_score.query.bool.filter;
      assert.ok(filters.length > 0);
      
      // Find the deprecated filter
      const deprecatedFilter = filters.find((f: any) => 
        f.bool && f.bool.should && 
        f.bool.should.some((s: any) => 
          s.bool?.must_not?.exists?.field === 'package.deprecated'
        )
      );
      assert.ok(deprecatedFilter, 'Should have deprecated filter');
    });

    it('should not filter deprecated packages when searchFilterDeprecated is false', async () => {
      mock(app.config.cnpmcore, 'searchFilterDeprecated', false);
      let capturedQuery: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: any) => {
          capturedQuery = params.body;
          return {
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        }
      );
      
      await app.httpRequest().get('/-/v1/search?text=example&from=0&size=1');
      
      // Verify no deprecated filter is added
      const filters = capturedQuery?.query?.function_score?.query?.bool?.filter || [];
      const deprecatedFilter = filters.find((f: any) => 
        f.bool && f.bool.should && 
        f.bool.should.some((s: any) => 
          s.bool?.must_not?.exists?.field === 'package.deprecated'
        )
      );
      assert.ok(!deprecatedFilter, 'Should not have deprecated filter');
    });

    it('should filter packages by minimum publish time', async () => {
      mock(app.config.cnpmcore, 'searchMinPublishTime', '2w');
      let capturedQuery: any;
      mockES.add(
        {
          method: 'POST',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
        },
        (params: any) => {
          capturedQuery = params.body;
          return {
            hits: {
              total: { value: 0, relation: 'eq' },
              hits: [],
            },
          };
        }
      );
      
      await app.httpRequest().get('/-/v1/search?text=example&from=0&size=1');
      
      // Verify that time filter is added
      const filters = capturedQuery?.query?.function_score?.query?.bool?.filter || [];
      const timeFilter = filters.find((f: any) => f.range && f.range['package.date']);
      assert.ok(timeFilter, 'Should have time filter');
      assert.ok(timeFilter.range['package.date'].lte, 'Should have lte constraint');
    });

    it('should accept different time formats for searchMinPublishTime', async () => {
      const testCases = [
        { input: '24h', expectedUnit: 'hour' },
        { input: '7d', expectedUnit: 'day' },
        { input: '2w', expectedUnit: 'week' },
      ];

      for (const testCase of testCases) {
        mock(app.config.cnpmcore, 'searchMinPublishTime', testCase.input);
        let capturedQuery: any;
        mockES.add(
          {
            method: 'POST',
            path: `/${app.config.cnpmcore.elasticsearchIndex}/_search`,
          },
          (params: any) => {
            capturedQuery = params.body;
            return {
              hits: {
                total: { value: 0, relation: 'eq' },
                hits: [],
              },
            };
          }
        );
        
        await app.httpRequest().get('/-/v1/search?text=example&from=0&size=1');
        
        const filters = capturedQuery?.query?.function_score?.query?.bool?.filter || [];
        const timeFilter = filters.find((f: any) => f.range && f.range['package.date']);
        assert.ok(timeFilter, `Should have time filter for ${testCase.input}`);
        
        mockES.clearAll();
        mock.restore();
        mock(app.config.cnpmcore, 'enableElasticsearch', true);
        mock(app.config.cnpmcore, 'elasticsearchIndex', 'cnpmcore_packages');
      }
    });
  });

  describe('[PUT /-/v1/search/sync/:fullname] sync()', async () => {
    it('should throw 451 when enableElasticsearch is false', async () => {
      mock(app.config.cnpmcore, 'enableElasticsearch', false);
      await app.httpRequest().put('/-/v1/search/sync/example').expect(451);
    });

    it('should upsert a example package', async () => {
      const name = 'testmodule-search-package';
      mockES.add(
        {
          method: 'PUT',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        () => {
          return {
            _id: name,
          };
        }
      );
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');
      const pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+-\w{24}$/);

      res = await app.httpRequest().put(`/-/v1/search/sync/${name}`);
      assert.equal(res.body.package, name);
    });

    it('should upsert a deprecated package with deprecated field', async () => {
      const name = 'testmodule-deprecated-package';
      let capturedDocument: any;
      mockES.add(
        {
          method: 'PUT',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        (params: any) => {
          capturedDocument = params.document;
          return {
            _id: name,
          };
        }
      );
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');
      
      const pkg = await TestUtil.getFullPackage({ 
        name, 
        version: '1.0.0',
        deprecated: 'This package is deprecated, use new-package instead'
      });
      
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);

      res = await app.httpRequest().put(`/-/v1/search/sync/${name}`);
      assert.equal(res.body.package, name);
      
      // Verify the deprecated field was synced to Elasticsearch
      assert.ok(capturedDocument);
      assert.equal(
        capturedDocument.package.deprecated, 
        'This package is deprecated, use new-package instead'
      );
    });
  });

  describe('[DELETE /-/v1/search/sync/:fullname] delete()', async () => {
    let admin: TestUser;
    beforeEach(async () => {
      admin = await TestUtil.createAdmin();
    });
    it('should throw 451 when enableElasticsearch is false', async () => {
      mock(app.config.cnpmcore, 'enableElasticsearch', false);
      await app
        .httpRequest()
        .delete('/-/v1/search/sync/example')
        .set('authorization', admin.authorization)
        .expect(451);
    });

    it('should delete a example package', async () => {
      const name = 'testmodule-search-package';
      mockES.add(
        {
          method: 'DELETE',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        () => {
          return {
            _id: name,
          };
        }
      );
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableElasticsearch', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');

      const res = await app
        .httpRequest()
        .delete(`/-/v1/search/sync/${name}`)
        .set('authorization', admin.authorization);
      assert.equal(res.body.package, name);
    });

    it('should delete a non existent package', async () => {
      const name = 'non-existent-search-package';
      mockES.add(
        {
          method: 'DELETE',
          path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
        },
        () => {
          return new errors.ResponseError({
            body: { errors: {}, status: 404 },
            statusCode: 404,
            warnings: null,
            meta: {
              name: '',
              context: '',
              request: {
                params: {
                  method: 'delete',
                  path: `/${app.config.cnpmcore.elasticsearchIndex}/_doc/:id`,
                },
                options: {},
                id: '',
              },
              connection: null,
              attempts: 1,
              aborted: true,
            },
          });
        }
      );
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableElasticsearch', true);
      mock(app.config.cnpmcore, 'registry', 'https://registry.example.com');

      const res = await app
        .httpRequest()
        .delete(`/-/v1/search/sync/${name}`)
        .set('authorization', admin.authorization);
      assert.equal(res.body.package, name);
    });
  });
});
