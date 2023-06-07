import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskState } from '../../../../app/common/enum/Task';
import { NFSAdapter } from '../../../../app/common/adapter/NFSAdapter';

describe('test/port/controller/PackageSyncController/showSyncTaskLog.test.ts', () => {
  let publisher;
  let taskRepository: TaskRepository;
  let nfsAdapter: NFSAdapter;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    taskRepository = await app.getEggObject(TaskRepository);
    nfsAdapter = await app.getEggObject(NFSAdapter);
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  describe('[GET /-/package/:fullname/syncs/:taskId/log] showSyncTaskLog()', () => {
    it('should 401 if user not login when alwaysAuth = true', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      mock(app.config.cnpmcore, 'alwaysAuth', true);
      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/syncs/mock-task-id/log`)
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    });

    it('should 404 when task not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/koa/syncs/mock-task-id/log')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] Package "koa" sync task "mock-task-id" not found');
    });

    it('should 200 and 302', async () => {
      let res = await app.httpRequest()
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.id);
      const task = await taskRepository.findTask(res.body.id);
      // waiting state logUrl is not exists
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}/log`);
      if (res.status === 404) {
        assert.equal(res.body.error, `[NOT_FOUND] Package "koa" sync task "${task!.taskId}" log not found`);
      } else {
        assert.equal(res.status, 302);
        const { status } = await app.curl(res.headers.location);
        assert.equal(status, 404);
      }

      task!.state = TaskState.Processing;
      await taskRepository.saveTask(task!);

      // log file not exists
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}/log`);
      if (res.status === 404) {
        assert.equal(res.body.error, `[NOT_FOUND] Package "koa" sync task "${task!.taskId}" log not found`);
      } else {
        assert.equal(res.status, 302);
        const { status } = await app.curl(res.headers.location);
        assert.equal(status, 404);
      }

      // save log file
      await nfsAdapter.uploadBytes(task!.logPath, Buffer.from('hello log file 😄\nsencod line here'));
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}/log`);
      if (res.status === 200) {
        assert.equal(res.text, 'hello log file 😄\nsencod line here');
        assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
      } else {
        assert.equal(res.status, 302);
        assert(res.headers.location);
        const log = await TestUtil.readStreamToLog(res.headers.location);
        assert.equal(log, 'hello log file 😄\nsencod line here');
      }

      // mock redirect
      mock.data(nfsAdapter.constructor.prototype, 'getDownloadUrlOrStream', 'http://mock.com/some.log');
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}/log`)
        .expect('location', 'http://mock.com/some.log')
        .expect(302);
    });
  });
});
