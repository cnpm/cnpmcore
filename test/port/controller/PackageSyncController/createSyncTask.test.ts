import assert = require('assert');
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

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('[PUT /-/package/:fullname/syncs] createSyncTask()', () => {
    it('should 403 when syncMode = none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package');
    });

    it('should 401 if user not login when alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(401);
      assert(res.body.error === '[UNAUTHORIZED] Login first');
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
      assert(res.body.error === '[FORBIDDEN] Can\'t sync private package "@cnpm/koa"');
    });

    it('should 201 if user login when alwaysAuth = true', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', publisher.authorization)
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.type === 'sync_package');
      assert(res.body.state === 'waiting');
      assert(res.body.id);
    });

    it('should 201 if user login when alwaysAuth = false', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', publisher.authorization)
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
    });

    it('should 201 if user not login when alwaysAuth = false', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      let task = await TaskModel.findOne({ taskId: res.body.id });
      assert(task);
      assert(task.data.skipDependencies === false);
      assert(task.data.syncDownloadData === false);

      res = await app.httpRequest()
        .put('/-/package/ob/syncs')
        .send({ skipDependencies: true, tips: 'foo bar' })
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      task = await TaskModel.findOne({ taskId: res.body.id });
      assert(task);
      assert(task.data.skipDependencies === true);
      assert(task.data.syncDownloadData === false);
      assert(task.data.tips === 'foo bar');
    });

    it('should 201 always convert name to lower case', async () => {
      const res = await app.httpRequest()
        .put('/-/package/MD5/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      const task = await TaskModel.findOne({ taskId: res.body.id });
      assert(task);
      assert(task.data.skipDependencies === false);
      assert(task.data.syncDownloadData === false);
      assert(task.targetName === 'md5');
    });

    it('should 422 when enableSyncDownloadData = false', async () => {
      let res = await app.httpRequest()
        .put('/-/package/ob/syncs')
        .send({ syncDownloadData: true });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package download data');

      mock(app.config.cnpmcore, 'syncDownloadDataSourceRegistry', 'https://rold.cnpmjs.org');
      mock(app.config.cnpmcore, 'enableSyncDownloadData', true);
      mock(app.config.cnpmcore, 'syncDownloadDataMaxDate', '');
      res = await app.httpRequest()
        .put('/-/package/ob/syncs')
        .send({ syncDownloadData: true });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package download data');

      mock(app.config.cnpmcore, 'syncDownloadDataSourceRegistry', '');
      mock(app.config.cnpmcore, 'enableSyncDownloadData', true);
      mock(app.config.cnpmcore, 'syncDownloadDataMaxDate', '2021-12-28');
      res = await app.httpRequest()
        .put('/-/package/ob/syncs')
        .send({ syncDownloadData: true });
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package download data');
    });

    it('should 201 when enableSyncDownloadData = true', async () => {
      mock(app.config.cnpmcore, 'syncDownloadDataSourceRegistry', 'https://rold.cnpmjs.org');
      mock(app.config.cnpmcore, 'enableSyncDownloadData', true);
      mock(app.config.cnpmcore, 'syncDownloadDataMaxDate', '2021-12-28');
      const res = await app.httpRequest()
        .put('/-/package/ob/syncs')
        .send({ syncDownloadData: true });
      assert(res.status === 201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      const task = await TaskModel.findOne({ taskId: res.body.id });
      assert(task);
      assert(task.data.syncDownloadData === true);
    });

    it('should dont create exists waiting task', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      const firstTaskId = res.body.id;
      // again dont create
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id === firstTaskId);
    });

    it('should dont create exists processing task update less than 1 min', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      const firstTaskId = res.body.id;

      await TaskModel.update({ taskId: firstTaskId }, { state: 'processing' });
      // again dont create
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'processing');
      assert(res.body.id === firstTaskId);

      // update bigger than 1 min
      await TaskModel.update({ taskId: firstTaskId }, { updatedAt: new Date(Date.now() - 60001) });
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id !== firstTaskId);
    });
  });

  describe('[PUT /:fullname/sync] deprecatedCreateSyncTask()', () => {
    it('should 403 when syncMode = none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .put('/koa/sync')
        .expect(403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package');
    });

    it('should 201', async () => {
      let res = await app.httpRequest()
        .put('/koa/sync')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.logId);
      let task = await TaskModel.findOne({ taskId: res.body.logId });
      assert(task);
      assert(task.data.skipDependencies === false);

      res = await app.httpRequest()
        .put('/koa/sync?nodeps=true')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.logId);

      res = await app.httpRequest()
        .put('/ob/sync?nodeps=true')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.logId);
      // skipDependencies should be true
      task = await TaskModel.findOne({ taskId: res.body.logId });
      assert(task);
      assert(task.data.skipDependencies === true);
    });

    it('should 201 and make sure name to lower case', async () => {
      const res = await app.httpRequest()
        .put('/MD5/sync')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.logId);
      const task = await TaskModel.findOne({ taskId: res.body.logId });
      assert(task);
      assert(task.data.skipDependencies === false);
      assert(task.targetName === 'md5');
    });
  });
});
