import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskState } from '../../../../app/common/enum/Task';

const SyncPackageWorkerPath = require.resolve('../../../../app/port/schedule/SyncPackageWorker');

describe('test/port/controller/PackageSyncController/showSyncTask.test.ts', () => {
  let publisher;
  let taskRepository: TaskRepository;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    taskRepository = await app.getEggObject(TaskRepository);
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  describe('[GET /-/package/:fullname/syncs/:taskId] showSyncTask()', () => {
    it('should 401 if user not login when alwaysAuth = true', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/syncs/mock-task-id`)
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    });

    it('should 404 when task not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/koa/syncs/mock-task-id')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] Package "koa" sync task "mock-task-id" not found');
    });

    it('should 200', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs');
      assert(res.status === 201);
      assert(res.body.id);
      const task = await taskRepository.findTask(res.body.id);
      assert(task);
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task.taskId}`);
      assert(res.status === 200);
      assert(res.body.id);
      // waiting state logUrl is not exists
      assert(!res.body.logUrl);

      task.state = TaskState.Processing;
      await taskRepository.saveTask(task!);
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task.taskId}`);
      assert(res.status === 200);
      assert(res.body.id);
      assert(res.body.logUrl);
      assert(res.body.logUrl.startsWith('http://localhost:7001/-/package/'));
      assert(res.body.logUrl.endsWith('/log'));
    });

    it('should get sucess task after schedule run', async () => {
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync-issue-1667', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/mk2test-module-cnpmsync-issue-1667.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync-issue-1667/-/mk2test-module-cnpmsync-issue-1667-3.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'mk2test-module-cnpmsync-issue-1667';
      let res = await app.httpRequest()
        .put(`/-/package/${name}/syncs`)
        .expect(201);
      const taskId = res.body.id;
      assert(taskId);
      res = await app.httpRequest()
        .get(`/-/package/${name}/syncs/${taskId}`)
        .expect(200);
      // waiting state logUrl is not exists
      assert(!res.body.logUrl);
      await app.runSchedule(SyncPackageWorkerPath);
      // again should work
      await app.runSchedule(SyncPackageWorkerPath);

      res = await app.httpRequest()
        .get(`/-/package/${name}/syncs/${taskId}`)
        .expect(200);
      assert.equal(res.body.state, TaskState.Success);
      assert(res.body.logUrl);

      res = await app.httpRequest()
        .get(`/-/package/${name}/syncs/${taskId}/log`);
      let log = '';
      if (res.status === 200) {
        log = res.text;
      } else {
        assert.equal(res.status, 302);
        log = await TestUtil.readStreamToLog(res.headers.location);
      }
      assert.match(log, /🔗/);

      // check hasInstallScript
      res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200);
      let pkg = res.body.versions['3.0.0'];
      assert(!('hasInstallScript' in pkg));
      assert(pkg.scripts);
      res = await app.httpRequest()
        .get(`/${name}`)
        .set('accept', 'application/vnd.npm.install-v1+json')
        .expect(200);
      pkg = res.body.versions['3.0.0'];
      assert(pkg.hasInstallScript === true);
      assert(!pkg.scripts);
    });
  });

  describe('[GET /:fullname/sync/log/:taskId] deprecatedShowSyncTask()', () => {
    it('should 404 when task not exists', async () => {
      const res = await app.httpRequest()
        .get('/koa/sync/log/mock-task-id')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] Package "koa" sync task "mock-task-id" not found');
    });

    it('should 200', async () => {
      let res = await app.httpRequest()
        .put('/koa/sync')
        .expect(201);
      assert(res.body.logId);
      const task = await taskRepository.findTask(res.body.logId);
      assert(task);

      res = await app.httpRequest()
        .get(`/koa/sync/log/${task.taskId}`)
        .expect(200);
      assert(res.body.ok);
      // waiting state logUrl is not exists
      assert(!res.body.logUrl);
      assert.equal(res.body.syncDone, false);
      assert(res.body.log);

      task!.state = TaskState.Processing;
      await taskRepository.saveTask(task!);

      res = await app.httpRequest()
        .get(`/koa/sync/log/${task.taskId}?t=123`)
        .expect(200);
      assert(res.body.logUrl);
      assert.match(res.body.logUrl, /^http:\/\/localhost:7001\/-\/package\//);
      assert.match(res.body.logUrl, /\/log$/);
      assert.equal(res.body.syncDone, false);
      assert(res.body.log);

      // finish
      task.state = TaskState.Success;
      await taskRepository.saveTask(task!);

      res = await app.httpRequest()
        .get(`/koa/sync/log/${task.taskId}`)
        .expect(200);
      assert(res.body.logUrl);
      assert.match(res.body.logUrl, /^http:\/\//);
      assert.match(res.body.logUrl, /\/log$/);
      assert.equal(res.body.syncDone, true);
      assert.match(res.body.log, /\[done\] Sync koa data: {/);
      assert.equal(res.body.error, undefined);
    });
  });
});
