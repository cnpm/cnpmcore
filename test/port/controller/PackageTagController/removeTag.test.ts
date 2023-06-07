import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageTagController/removeTag.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[DELETE /-/package/:fullname/dist-tags/:tag] removeTag()', () => {
    it('should 401 when readonly token', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const userReadonly = await TestUtil.createTokenByUser({
        password: publisher.password,
        token: publisher.token,
        readonly: true,
      });
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', userReadonly.authorization)
        .set('user-agent', publisher.ua)
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token/);
    });

    it('should 403 when non-maintainer add tag', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const other = await TestUtil.createUser();
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', other.authorization)
        .set('user-agent', publisher.ua)
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${other.name}" not authorized to modify @cnpm/koa, please contact maintainers: "${publisher.name}"`);
    });

    it('should 200 when tag not exists', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(200);
      assert.equal(res.body.ok, true);
    });

    it('should 422 when tag invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/1.0`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] tag: must match format "semver-tag"');
    });

    it('should 422 when tag is latest', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/latest`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Can\'t remove the "latest" tag');
    });

    it('should 200', async () => {
      let pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '2.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta: '1.0.0',
      });

      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/${encodeURIComponent(' beta2 ')}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('2.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta: '1.0.0',
        beta2: '2.0.0',
      });

      res = await app.httpRequest()
        .delete(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '2.0.0',
        beta2: '2.0.0',
      });
    });
  });
});
