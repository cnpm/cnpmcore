import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { HookManageService } from '../../../../app/core/service/HookManageService';
import { Hook } from '../../../../app/core/entity/Hook';
import { UserRepository } from '../../../../app/repository/UserRepository';
import { HookType } from '../../../../app/common/enum/Hook';

describe('test/port/controller/hook/HookController.test.ts', () => {
  let hookManageService: HookManageService;
  let user;
  let userId;

  beforeEach(async () => {
    user = await TestUtil.createUser();
    hookManageService = await app.getEggObject(HookManageService);
    const userRepository = await app.getEggObject(UserRepository);
    const userEntity = await userRepository.findUserByName(user.name);
    userId = userEntity?.userId;
  });

  describe('POST /-/npm/v1/hooks/hook', () => {
    it('should work', async () => {
      const res = await app.httpRequest()
        .post('/-/npm/v1/hooks/hook')
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send({
          type: 'scope',
          name: '@cnpmcore',
          endpoint: 'https://example.com/webhook',
          secret: 'this is certainly very secret',
        })
        .expect(200);
      assert(res.body);
      assert(res.body.id);
      assert(res.body.username === user.name);
      assert(res.body.name === '@cnpmcore');
      assert(res.body.endpoint === 'https://example.com/webhook');
      assert(res.body.secret === 'this is certainly very secret');
      assert(res.body.type === HookType.Scope);
      assert(res.body.created);
      assert(res.body.updated);
      assert(res.body.delivered === false);
      assert(res.body.last_delivery === null);
      assert(res.body.response_code === 0);
      assert(res.body.status === 'active');
    });
  });

  describe('PUT /-/npm/v1/hooks/hook/:id', () => {
    let hook: Hook;
    beforeEach(async () => {
      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: 'foo_package',
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
    });

    it('should work', async () => {
      const res = await app.httpRequest()
        .put(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send({
          endpoint: 'https://new.com/webhook',
          secret: 'new secret',
        })
        .expect(200);
      assert(res.body.endpoint === 'https://new.com/webhook');
      assert(res.body.secret === 'new secret');
    });
  });

  describe('DELETE /-/npm/v1/hooks/hook/:id', () => {
    let hook: Hook;
    beforeEach(async () => {
      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: 'foo_package',
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
    });

    it('should work', async () => {
      const res = await app.httpRequest()
        .delete(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert(res.body.deleted === true);
    });
  });

  describe('GET /-/npm/v1/hooks', () => {
    beforeEach(async () => {
      await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: 'foo_package',
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
    });

    it('should work', async () => {
      const res = await app.httpRequest()
        .get('/-/npm/v1/hooks')
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert(res.body.objects.length === 1);
    });
  });

  describe('GET /-/npm/v1/hooks/hook/:id', () => {
    let hook: Hook;
    beforeEach(async () => {
      hook = await hookManageService.createHook({
        type: HookType.Package,
        ownerId: userId,
        name: 'foo_package',
        endpoint: 'http://foo.com',
        secret: 'mock_secret',
      });
    });

    it('should work', async () => {
      const res = await app.httpRequest()
        .get(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert(res.body);
      assert(res.body.id === hook.hookId);
      assert(res.body.username === user.name);
      assert(res.body.name === 'foo_package');
      assert(res.body.endpoint === 'http://foo.com');
      assert(res.body.secret === 'mock_secret');
      assert(res.body.type === HookType.Package);
      assert(res.body.created);
      assert(res.body.updated);
      assert(res.body.delivered === false);
      assert(res.body.last_delivery === null);
      assert(res.body.response_code === 0);
      assert(res.body.status === 'active');
    });
  });
});
