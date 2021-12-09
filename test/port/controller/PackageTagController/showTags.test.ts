import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/PackageTagController/showTags.test.ts', () => {
  let publisher;
  let ctx: Context;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /-/package/:fullname/dist-tags] showTags()', () => {
    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/not-exists/dist-tags')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] not-exists not found');
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
  });
});
