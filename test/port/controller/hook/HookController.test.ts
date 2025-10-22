import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil, type TestUser } from '../../../../test/TestUtil.ts';
import { HookManageService } from '../../../../app/core/service/HookManageService.ts';
import type { Hook } from '../../../../app/core/entity/Hook.ts';
import { UserRepository } from '../../../../app/repository/UserRepository.ts';
import { HookType } from '../../../../app/common/enum/Hook.ts';

describe('test/port/controller/hook/HookController.test.ts', () => {
  let hookManageService: HookManageService;
  let user: TestUser;
  let userId: string;

  beforeEach(async () => {
    user = await TestUtil.createUser();
    hookManageService = await app.getEggObject(HookManageService);
    const userRepository = await app.getEggObject(UserRepository);
    const userEntity = await userRepository.findUserByName(user.name);
    assert.ok(userEntity);
    userId = userEntity.userId;
  });

  describe('POST /-/npm/v1/hooks/hook', () => {
    it('should work', async () => {
      const res = await app
        .httpRequest()
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
      assert.ok(res.body);
      assert.ok(res.body.id);
      assert.ok(res.body.username === user.name);
      assert.ok(res.body.name === '@cnpmcore');
      assert.ok(res.body.endpoint === 'https://example.com/webhook');
      assert.ok(res.body.secret === 'this is certainly very secret');
      assert.ok(res.body.type === HookType.Scope);
      assert.ok(res.body.created);
      assert.ok(res.body.updated);
      assert.ok(res.body.delivered === false);
      assert.ok(res.body.last_delivery === null);
      assert.ok(res.body.response_code === 0);
      assert.ok(res.body.status === 'active');
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
      const res = await app
        .httpRequest()
        .put(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send({
          endpoint: 'https://new.com/webhook',
          secret: 'new secret',
        })
        .expect(200);
      assert.ok(res.body.endpoint === 'https://new.com/webhook');
      assert.ok(res.body.secret === 'new secret');
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
      const res = await app
        .httpRequest()
        .delete(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert.ok(res.body.deleted === true);
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
      const res = await app
        .httpRequest()
        .get('/-/npm/v1/hooks')
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert.ok(res.body.objects.length === 1);
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
      const res = await app
        .httpRequest()
        .get(`/-/npm/v1/hooks/hook/${hook.hookId}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .expect(200);
      assert.ok(res.body);
      assert.ok(res.body.id === hook.hookId);
      assert.ok(res.body.username === user.name);
      assert.ok(res.body.name === 'foo_package');
      assert.ok(res.body.endpoint === 'http://foo.com');
      assert.ok(res.body.secret === 'mock_secret');
      assert.ok(res.body.type === HookType.Package);
      assert.ok(res.body.created);
      assert.ok(res.body.updated);
      assert.ok(res.body.delivered === false);
      assert.ok(res.body.last_delivery === null);
      assert.ok(res.body.response_code === 0);
      assert.ok(res.body.status === 'active');
    });
  });
});
