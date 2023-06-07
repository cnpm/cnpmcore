import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/PackageTagController/saveTag.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[PUT /-/package/:fullname/dist-tags/:tag] saveTag()', () => {
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
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', userReadonly.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
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
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', other.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${other.name}" not authorized to modify @cnpm/koa, please contact maintainers: "${publisher.name}"`);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('199.0.0'))
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/koa@199.0.0 not found');
    });

    it('should 422 when version invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
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
        .send(JSON.stringify('     '))
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] version: must NOT have fewer than 5 characters');
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify(''))
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] version: must NOT have fewer than 5 characters');
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('wrong.ver.1'))
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] version: must match format "semver-version"');
    });

    it('should 422 when tag invalid', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/111`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] tag: must match format "semver-tag"');
    });

    it('should 200 when publish package in current registry', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const { pkg, user } = await TestUtil.createPackage({ name: 'non_scope_pkg', version: '1.0.0' });
      await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
    });

    it('should 200', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
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
        latest: '1.0.0',
        beta: '1.0.0',
      });
      // save tag and version ignore
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      // support latest tag
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/latest`)
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
        latest: '1.0.0',
        beta: '1.0.0',
      });
    });

    it('should 200 on automation token', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const userAutomation = await TestUtil.createTokenByUser({
        password: publisher.password,
        token: publisher.token,
        automation: true,
      });
      let res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/automation`)
        .set('authorization', userAutomation.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        automation: '1.0.0',
      });
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/latest-3`)
        .set('authorization', userAutomation.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('1.0.0'))
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepEqual(res.body['dist-tags'], {
        latest: '1.0.0',
        'latest-3': '1.0.0',
        automation: '1.0.0',
      });
    });
  });
});
