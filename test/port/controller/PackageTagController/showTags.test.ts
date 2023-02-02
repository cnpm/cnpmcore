import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/PackageTagController/showTags.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[GET /-/package/:fullname/dist-tags] showTags()', () => {
    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/@cnpm/not-exists/dist-tags')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/not-exists not found');
    });

    it('should 404 when package not exists on syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      let res = await app.httpRequest()
        .get('/-/package/not-exists/dist-tags');
      assert(res.status === 404);
      assert(res.body.error === '[NOT_FOUND] not-exists not found');

      res = await app.httpRequest()
        .get('/-/package/@foo/not-exists/dist-tags');
      assert(res.status === 404);
      assert(res.body.error === '[NOT_FOUND] @foo/not-exists not found');
    });

    it('should 404 when package not exists on proxy mode', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      mock(app.config.cnpmcore, 'enableProxyMode', true);
      const res = await app.httpRequest()
        .get('/-/package/@cnpm/not-exists/dist-tags')
        .expect(404);
      // not found message from source registry
      assert.equal(res.body.error, 'Not found');
    });

    it('should 302 when package not exists on syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      let res = await app.httpRequest()
        .get('/-/package/not-exists/dist-tags');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/-/package/not-exists/dist-tags');

      res = await app.httpRequest()
        .get('/-/package/@foo/not-exists/dist-tags');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/-/package/@foo/not-exists/dist-tags');
    });

    it('should get package tags', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/dist-tags`)
        .expect(200);
      assert.equal(res.body.latest, '1.0.0');
      assert.deepEqual(Object.keys(res.body), [ 'latest' ]);
    });

    it('should get package tags on proxy mode', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      mock(app.config.cnpmcore, 'enableProxyMode', true);
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      app.mockHttpclient(`${app.config.cnpmcore.sourceRegistry}/${encodeURIComponent(pkg.name)}?t=${Date.now()}&cache=0`, 'get', { data: pkg });
      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/dist-tags`);
      assert.equal(res.body.latest, '1.0.0');
      assert.deepEqual(Object.keys(res.body), [ 'latest' ]);
    });
  });
});
