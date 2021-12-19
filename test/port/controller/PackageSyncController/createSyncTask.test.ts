import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { Task as TaskModel } from 'app/repository/model/Task';

describe('test/port/controller/PackageSyncController/createSyncTask.test.ts', () => {
  let publisher;
  let ctx: Context;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[PUT /-/package/:fullname/syncs] createSyncTask()', () => {
    it('should 403 when syncMode = none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Not allow to sync package');
    });

    it('should 401 if user not login when alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    });

    it('should 403 if when sync private package', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/syncs`)
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Can\'t sync private package "@cnpm/koa"');
    });

    it('should 201 if user login when alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', publisher.authorization)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.type, 'sync_package');
      assert.equal(res.body.state, 'waiting');
      assert(res.body.id);
    });

    it('should 201 if user login when alwaysAuth = false', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', publisher.authorization)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert(res.body.id);
    });

    it('should 201 if user not login when alwaysAuth = false', async () => {
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert(res.body.id);
    });

    it('should dont create exists waiting task', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert(res.body.id);
      const firstTaskId = res.body.id;
      // again dont create
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert.equal(res.body.id, firstTaskId);
    });

    it('should dont create exists processing task update less than 1 min', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert(res.body.id);
      const firstTaskId = res.body.id;

      await TaskModel.update({ taskId: firstTaskId }, { state: 'processing' });
      // again dont create
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'processing');
      assert.equal(res.body.id, firstTaskId);

      // update bigger than 1 min
      await TaskModel.update({ taskId: firstTaskId }, { updatedAt: new Date(Date.now() - 60001) });
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.state, 'waiting');
      assert.notEqual(res.body.id, firstTaskId);
    });
  });

  describe('[PUT /:fullname/sync] deprecatedCreateSyncTask()', () => {
    it('should 403 when syncMode = none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .put('/koa/sync')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Not allow to sync package');
    });

    it('should 201', async () => {
      let res = await app.httpRequest()
        .put('/koa/sync')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert(res.body.logId);

      res = await app.httpRequest()
        .put('/koa/sync?nodeps=true')
        .expect(201);
      assert.equal(res.body.ok, true);
      assert(res.body.logId);
    });
  });
});
