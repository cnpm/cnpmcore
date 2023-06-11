import assert from 'assert';
import { setTimeout } from 'timers/promises';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { Task as TaskModel } from '../../../../app/repository/model/Task';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService';

describe('test/port/controller/PackageSyncController/createSyncTask.test.ts', () => {
  let publisher: any;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  describe('[PUT /-/package/:fullname/syncs] createSyncTask()', () => {
    it('should 403 when syncMode = none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(403);
      assert(res.body.error === '[FORBIDDEN] Not allow to sync package');
    });

    it('should 403 when syncMode = admin', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'admin');
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(403);
      assert(res.body.error === '[FORBIDDEN] Only admin allow to sync package');
    });

    it('should 201 when syncMode = admin & login as admin', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'admin');
      const adminUser = await TestUtil.createAdmin();
      await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', adminUser.authorization)
        .expect(201);
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

    it('should 422 if specificVersions cannot parse is not valideted', async () => {
      await app.httpRequest()
        .put('/-/package/koa/syncs')
        .send({ specificVersions: '1.0.0' })
        .expect(422);
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
      app.notExpectLog('[PackageSyncController.createSyncTask:execute-immediately]');
    });

    it('should not sync immediately when normal user request', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      const res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .set('authorization', publisher.authorization)
        .send({ force: true })
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      app.notExpectLog('[PackageSyncController.createSyncTask:execute-immediately]');
    });

    it('should sync immediately when admin user request', async () => {
      app.mockHttpclient('https://registry.npmjs.org/koa-not-exists', 'GET', {
        status: 404,
        data: { error: 'Not found' },
        persist: false,
      });
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      const admin = await TestUtil.createAdmin();
      const res = await app.httpRequest()
        .put('/-/package/koa-not-exists/syncs')
        .set('authorization', admin.authorization)
        .send({ force: true })
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      await setTimeout(100); // await for sync task started
      app.expectLog('[PackageSyncController.createSyncTask:execute-immediately]');
      app.expectLog('[PackageSyncController:executeTask:start]');
      app.expectLog(', targetName: koa-not-exists,');
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should error when invalid registryName', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      const admin = await TestUtil.createAdmin();
      const res = await app.httpRequest()
        .put('/-/package/koa-not-exists/syncs')
        .set('authorization', admin.authorization)
        .send({ registryName: 'invalid' })
        .expect(403);

      assert(res.body.error.includes('Can\'t find target registry'));
    });

    it('should check the packageEntity registryId', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      await TestUtil.createPackage({
        name: '@cnpm/banana',
        registryId: 'mock_registry_id',
        isPrivate: false,
      });
      const admin = await TestUtil.createAdmin();
      // create registry
      await app.httpRequest()
        .post('/-/registry')
        .set('authorization', admin.authorization)
        .send(
          {
            name: 'cnpm',
            host: 'https://r.cnpmjs.org/',
            changeStream: 'https://r.cnpmjs.org/_changes',
            type: 'cnpmcore',
          });

      const res = await app.httpRequest()
        .put('/-/package/@cnpm/banana/syncs')
        .set('authorization', admin.authorization)
        .send({ registryName: 'cnpm' })
        .expect(403);

      assert(res.body.error.includes('The package is synced from'));
    });

    it('should ignore the packageEntity registryId when registry not exists', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      await TestUtil.createPackage({
        name: '@cnpm/banana',
        registryId: 'mock_registry_id',
        isPrivate: false,
      });
      const admin = await TestUtil.createAdmin();
      // create registry
      await app.httpRequest()
        .post('/-/registry')
        .set('authorization', admin.authorization)
        .send(
          {
            name: 'cnpm',
            host: 'https://r.cnpmjs.org/',
            changeStream: 'https://r.cnpmjs.org/_changes',
            type: 'cnpmcore',
          });

      const res = await app.httpRequest()
        .put('/-/package/@cnpm/banana/syncs')
        .set('authorization', admin.authorization)
        .send()
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
    });

    it('should sync immediately and mock executeTask error when admin user request', async () => {
      mock(app.config.cnpmcore, 'alwaysAuth', false);
      mock.error(PackageSyncerService.prototype, 'executeTask');
      const admin = await TestUtil.createAdmin();
      const res = await app.httpRequest()
        .put('/-/package/koa-not-exists-error/syncs')
        .set('authorization', admin.authorization)
        .send({ force: true })
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id);
      app.expectLog('[PackageSyncController.createSyncTask:execute-immediately]');
      app.expectLog('[PackageSyncController:executeTask:start]');
      app.expectLog(', targetName: koa-not-exists-error,');
      await setTimeout(100);
      app.expectLog('[PackageSyncController:executeTask:error]');
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

      // update bigger than 1 min, same task return
      await TaskModel.update({ taskId: firstTaskId }, { updatedAt: new Date(Date.now() - 60001) });
      res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.ok === true);
      assert(res.body.state === 'waiting');
      assert(res.body.id === firstTaskId);
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

    it('should 403 when syncMode = admin', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'admin');
      const res = await app.httpRequest()
        .put('/koa/sync')
        .expect(403);
      assert(res.body.error === '[FORBIDDEN] Only admin allow to sync package');
    });

    it('should 201 when syncMode = admin & login as admin', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'admin');
      const adminUser = await TestUtil.createAdmin();
      await app.httpRequest()
        .put('/koa/sync')
        .set('authorization', adminUser.authorization)
        .expect(201);
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
  });
});
