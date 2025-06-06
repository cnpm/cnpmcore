import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil, type TestUser } from '../../../../test/TestUtil.js';
import { TaskRepository } from '../../../../app/repository/TaskRepository.js';
import { TaskState } from '../../../../app/common/enum/Task.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SyncPackageWorkerPath = path.join(
  __dirname,
  '../../../../app/port/schedule/SyncPackageWorker.ts'
);

describe('test/port/controller/PackageSyncController/showSyncTask.test.ts', () => {
  let publisher: TestUser;
  let taskRepository: TaskRepository;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    taskRepository = await app.getEggObject(TaskRepository);
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  describe('[GET /-/package/:fullname/syncs/:taskId] showSyncTask()', () => {
    it('should 401 if user not login when alwaysAuth = true', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/koa',
        version: '1.0.0',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app
        .httpRequest()
        .get(`/-/package/${pkg.name}/syncs/mock-task-id`)
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    });

    it('should 404 when task not exists', async () => {
      const res = await app
        .httpRequest()
        .get('/-/package/koa/syncs/mock-task-id')
        .expect(404);
      assert.equal(
        res.body.error,
        '[NOT_FOUND] Package "koa" sync task "mock-task-id" not found'
      );
    });

    it('should 200', async () => {
      let res = await app.httpRequest().put('/-/package/koa/syncs');
      assert.ok(res.status === 201);
      assert.ok(res.body.id);
      const task = await taskRepository.findTask(res.body.id);
      assert.ok(task);
      res = await app.httpRequest().get(`/-/package/koa/syncs/${task.taskId}`);
      assert.ok(res.status === 200);
      assert.ok(res.body.id);
      // waiting state logUrl is not exists
      assert.ok(!res.body.logUrl);

      task.state = TaskState.Processing;
      await taskRepository.saveTask(task);
      res = await app.httpRequest().get(`/-/package/koa/syncs/${task.taskId}`);
      assert.ok(res.status === 200);
      assert.ok(res.body.id);
      assert.ok(res.body.logUrl);
      assert.ok(res.body.logUrl.startsWith('http://localhost:7001/-/package/'));
      assert.ok(res.body.logUrl.endsWith('/log'));
    });

    it('should get sucess task after schedule run', async () => {
      app.mockHttpclient(
        'https://registry.npmjs.org/mk2test-module-cnpmsync-issue-1667',
        'GET',
        {
          data: await TestUtil.readFixturesFile(
            'registry.npmjs.org/mk2test-module-cnpmsync-issue-1667.json'
          ),
          persist: false,
        }
      );
      app.mockHttpclient(
        'https://registry.npmjs.org/mk2test-module-cnpmsync-issue-1667/-/mk2test-module-cnpmsync-issue-1667-3.0.0.tgz',
        'GET',
        {
          data: await TestUtil.readFixturesFile(
            'registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'
          ),
          persist: false,
        }
      );
      const name = 'mk2test-module-cnpmsync-issue-1667';
      let res = await app
        .httpRequest()
        .put(`/-/package/${name}/syncs`)
        .expect(201);
      const taskId = res.body.id;
      assert.ok(taskId);
      res = await app
        .httpRequest()
        .get(`/-/package/${name}/syncs/${taskId}`)
        .expect(200);
      // waiting state logUrl is not exists
      assert.ok(!res.body.logUrl);
      await app.runSchedule(SyncPackageWorkerPath);
      // again should work
      await app.runSchedule(SyncPackageWorkerPath);

      res = await app
        .httpRequest()
        .get(`/-/package/${name}/syncs/${taskId}`)
        .expect(200);
      assert.equal(res.body.state, TaskState.Success);
      assert.ok(res.body.logUrl);

      res = await app
        .httpRequest()
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
      res = await app.httpRequest().get(`/${name}`).expect(200);
      let pkg = res.body.versions['3.0.0'];
      assert.ok(!('hasInstallScript' in pkg));
      assert.ok(pkg.scripts);
      res = await app
        .httpRequest()
        .get(`/${name}`)
        .set('accept', 'application/vnd.npm.install-v1+json')
        .expect(200);
      pkg = res.body.versions['3.0.0'];
      assert.ok(pkg.hasInstallScript === true);
      assert.ok(!pkg.scripts);
    });
  });

  describe('[GET /:fullname/sync/log/:taskId] deprecatedShowSyncTask()', () => {
    it('should 404 when task not exists', async () => {
      const res = await app
        .httpRequest()
        .get('/koa/sync/log/mock-task-id')
        .expect(404);
      assert.equal(
        res.body.error,
        '[NOT_FOUND] Package "koa" sync task "mock-task-id" not found'
      );
    });

    it('should 200', async () => {
      let res = await app.httpRequest().put('/koa/sync').expect(201);
      assert.ok(res.body.logId);
      const task = await taskRepository.findTask(res.body.logId);
      assert.ok(task);

      res = await app
        .httpRequest()
        .get(`/koa/sync/log/${task.taskId}`)
        .expect(200);
      assert.ok(res.body.ok);
      // waiting state logUrl is not exists
      assert.ok(!res.body.logUrl);
      assert.equal(res.body.syncDone, false);
      assert.ok(res.body.log);

      task.state = TaskState.Processing;
      await taskRepository.saveTask(task);

      res = await app
        .httpRequest()
        .get(`/koa/sync/log/${task.taskId}?t=123`)
        .expect(200);
      assert.ok(res.body.logUrl);
      assert.match(res.body.logUrl, /^http:\/\/localhost:7001\/-\/package\//);
      assert.match(res.body.logUrl, /\/log$/);
      assert.equal(res.body.syncDone, false);
      assert.ok(res.body.log);

      // finish
      task.state = TaskState.Success;
      await taskRepository.saveTask(task);

      res = await app
        .httpRequest()
        .get(`/koa/sync/log/${task.taskId}`)
        .expect(200);
      assert.ok(res.body.logUrl);
      assert.match(res.body.logUrl, /^http:\/\//);
      assert.match(res.body.logUrl, /\/log$/);
      assert.equal(res.body.syncDone, true);
      assert.match(res.body.log, /\[done\] Sync koa data: {/);
      assert.equal(res.body.error, undefined);
    });
  });
});
