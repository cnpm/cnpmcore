import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { HookType } from '../../../../app/common/enum/Hook.ts';
import type { Hook } from '../../../../app/core/entity/Hook.ts';
import { HookManageService } from '../../../../app/core/service/HookManageService.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/core/service/HookManageService/updateHook.test.ts', () => {
  let hookManageService: HookManageService;
  let hook: Hook;

  beforeEach(async () => {
    hookManageService = await app.getEggObject(HookManageService);
    hook = await hookManageService.createHook({
      type: HookType.Package,
      ownerId: 'mock_owner_id',
      name: 'foo_package',
      endpoint: 'http://foo.com',
      secret: 'mock_secret',
    });
  });

  afterEach(async () => {
    await TestUtil.truncateDatabase();
    mock.restore();
  });

  describe('hook not found', () => {
    it('should throw error', async () => {
      await assert.rejects(async () => {
        await hookManageService.updateHook({
          hookId: 'not_exist_hook_id',
          operatorId: 'mock_owner_id',
          endpoint: 'http://foo.com',
          secret: 'mock_secret',
        });
      }, /hook not_exist_hook_id not found/);
    });
  });

  describe('hook not belong to operator', () => {
    it('should throw error', async () => {
      await assert.rejects(
        async () => {
          await hookManageService.updateHook({
            hookId: hook.hookId,
            operatorId: 'not_exits_owner_id',
            endpoint: 'http://foo.com',
            secret: 'mock_secret',
          });
        },
        new RegExp(`hook ${hook.hookId} not belong to not_exits_owner_id`),
      );
    });
  });

  it('should work', async () => {
    const updatedHook = await hookManageService.updateHook({
      hookId: hook.hookId,
      operatorId: 'mock_owner_id',
      endpoint: 'http://new.com',
      secret: 'new_mock_secret',
    });
    assert.ok(updatedHook);
    assert.ok(updatedHook.endpoint === 'http://new.com');
    assert.ok(updatedHook.secret === 'new_mock_secret');
  });
});
