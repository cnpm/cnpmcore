import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskState } from '../../../../app/common/enum/Task';

describe('test/port/controller/PackageSyncController/showSyncTask.test.ts', () => {
  let publisher;
  let ctx: Context;
  let taskRepository: TaskRepository;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    taskRepository = await ctx.getEggObject(TaskRepository);
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
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
        .put('/-/package/koa/syncs')
        .expect(201);
      assert(res.body.id);
      const task = await taskRepository.findTask(res.body.id);
      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}`)
        .expect(200);
      assert(res.body.id);
      // waiting state logUrl is not exists
      assert(!res.body.logUrl);

      task!.state = TaskState.Processing;
      await taskRepository.saveTask(task!);

      res = await app.httpRequest()
        .get(`/-/package/koa/syncs/${task!.taskId}`)
        .expect(200);
      assert(res.body.id);
      assert(res.body.logUrl);
      assert.match(res.body.logUrl, /^http:\/\//);
      assert.match(res.body.logUrl, /\/log$/);
    });
  });
});
