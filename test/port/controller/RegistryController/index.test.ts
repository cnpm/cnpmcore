import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TaskType } from '../../../../app/common/enum/Task';
import { Registry } from '../../../../app/core/entity/Registry';
import { ChangesStreamTaskData } from '../../../../app/core/entity/Task';
import { TaskService } from '../../../../app/core/service/TaskService';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/RegistryController/index.test.ts', () => {
  let adminUser: any;
  let registry: Registry;
  let taskService: TaskService;
  before(async () => {
    taskService = await app.getEggObject(TaskService);
  });
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    // create success
    await app.httpRequest()
      .post('/-/registry')
      .set('authorization', adminUser.authorization)
      .send(
        {
          name: 'custom3',
          host: 'https://r.cnpmjs.org/',
          changeStream: 'https://r.cnpmjs.org/_changes',
          type: 'cnpmcore',
        })
      .expect(200);

    // query success
    const res = await app.httpRequest()
      .get('/-/registry')
      .expect(200);

    registry = res.body.data[0];

    // create scope
    await app.httpRequest()
      .post('/-/scope')
      .set('authorization', adminUser.authorization)
      .send({
        name: '@cnpm',
        registryId: registry.registryId,
      })
      .expect(200);
  });

  describe('[POST /-/registry] createRegistry()', () => {
    it('should 200', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: 'custom6',
            host: 'https://r.cnpmjs.org/',
            changeStream: 'https://r.cnpmjs.org/_changes',
            type: 'cnpmcore',
          });

      assert(res.body.ok);
    });

    it('should verify params', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: 'custom',
            type: 'cnpmcore',
          })
        .expect(422);

      assert(res.body.error === '[INVALID_PARAM] must have required property \'host\'');
    });

    it('should 403', async () => {
      // create forbidden
      const res = await app.httpRequest()
        .post('/-/registry')
        .send(
          {
            name: 'custom',
            host: 'https://r.cnpmjs.org/',
            changeStream: 'https://r.cnpmjs.org/_changes',
            type: 'cnpmcore',
          })
        .expect(403);

      assert(res.body.error === '[FORBIDDEN] Not allow to access');
    });

  });

  describe('[GET /-/registry] listRegistries()', () => {
    it('should 200', async () => {
      // create success
      await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: 'custom5',
            host: 'https://r.cnpmjs.org/',
            changeStream: 'https://r.cnpmjs.org/_changes',
            type: 'cnpmcore',
          })
        .expect(200);

      // query success
      const res = await app.httpRequest()
        .get('/-/registry')
        .expect(200);

      assert(res.body.count === 2);
      assert(res.body.data[1].name === 'custom5');
    });
  });

  describe('[GET /-/registry/:id/scopes] showRegistryScopes()', () => {
    it('should 200', async () => {
      // create scope
      await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send({
          registryId: registry.registryId,
          name: '@banana',
        });

      await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send({
          registryId: registry.registryId,
          name: '@apple',
        });

      await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send({
          registryId: registry.registryId,
          name: '@orange',
        });

      let scopRes = await app.httpRequest()
        .get(`/-/registry/${registry.registryId}/scopes`)
        .expect(200);
      assert(scopRes.body.count === 4);
      assert(scopRes.body.data.length === 4);

      scopRes = await app.httpRequest()
        .get(`/-/registry/${registry.registryId}/scopes?pageSize=1`)
        .expect(200);
      assert(scopRes.body.count === 4);
      assert(scopRes.body.data.length === 1);

      scopRes = await app.httpRequest()
        .get(`/-/registry/${registry.registryId}/scopes?pageSize=2&pageIndex=1`)
        .expect(200);
      assert(scopRes.body.count === 4);
      assert(scopRes.body.data.length === 2);

    });
    it('should error', async () => {
      await app.httpRequest()
        .get('/-/registry/not_exist_id/scopes')
        .expect(404);
    });
  });

  describe('[GET /-/registry/:id] showRegistry()', () => {
    it('should 200', async () => {
      const queryRes = await app.httpRequest()
        .get(`/-/registry/${registry.registryId}`);
      assert.deepEqual(queryRes.body, registry);
    });

    it('should error', async () => {
      await app.httpRequest()
        .get('/-/registry/not_exist_id')
        .expect(404);
    });
  });

  describe('[DELETE /-/registry] deleteRegistry()', () => {
    it('should 200', async () => {
      await app.httpRequest()
        .delete(`/-/registry/${registry.registryId}`)
        .set('authorization', adminUser.authorization)
        .expect(200);

      // query success
      const queryRes = await app.httpRequest()
        .get('/-/registry')
        .set('authorization', adminUser.authorization)
        .expect(200);

      assert(queryRes.body.count === 0);
    });
  });

  describe('[POST /-/registry/:id/sync] createRegistrySyncTask()', () => {
    it('should 403', async () => {
      await app.httpRequest()
        .post(`/-/registry/${registry.registryId}/sync`)
        .expect(403);
    });

    it('should error when invalid registryId', async () => {
      const res = await app.httpRequest()
        .post('/-/registry/in_valid/sync')
        .set('authorization', adminUser.authorization)
        .expect(404);
      assert(res.body.error.includes('registry not found'));
    });

    it('should 200', async () => {
      await app.httpRequest()
        .post(`/-/registry/${registry.registryId}/sync`)
        .set('authorization', adminUser.authorization)
        .expect(200);

      const task = await taskService.findExecuteTask(TaskType.ChangesStream);
      assert(task?.targetName === 'CUSTOM3_WORKER');
    });

    it('since params', async () => {
      await app.httpRequest()
        .post(`/-/registry/${registry.registryId}/sync`)
        .set('authorization', adminUser.authorization)
        .send({
          since: '9527',
        })
        .expect(200);

      const task = await taskService.findExecuteTask(TaskType.ChangesStream);
      assert(task?.targetName === 'CUSTOM3_WORKER');
      assert((task?.data as ChangesStreamTaskData).since === '9527');
    });
  });

  describe('[PATCH /-/registry/:id] updateRegistry()', () => {
    it('should 403', async () => {
      await app.httpRequest()
        .patch(`/-/registry/${registry.registryId}`)
        .expect(403);
    });

    it('should 404 when not found', async () => {
      await app.httpRequest()
        .patch('/-/registry/registry-not-exists')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });

    it('should update auth token success', async () => {
      await app.httpRequest()
        .patch(`/-/registry/${registry.registryId}`)
        .set('authorization', adminUser.authorization)
        .send({
          authToken: 'testAuthToekn',
        })
        .expect(200);

      const registList = await app.httpRequest()
        .get('/-/registry')
        .expect(200);

      const latestToken = await registList.body.data[0].authToken;
      assert.equal(latestToken, 'testAuthToekn');
    });
  });

});
