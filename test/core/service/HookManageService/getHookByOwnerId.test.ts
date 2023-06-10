import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { HookManageService } from '../../../../app/core/service/HookManageService';
import { Hook } from '../../../../app/core/entity/Hook';
import { HookType } from '../../../../app/common/enum/Hook';

describe('test/core/service/HookManageService/getHookByOwnerId.test.ts', () => {
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
        await hookManageService.getHookByOwnerId('not_exist_hook_id', 'mock_owner_id');
      }, /hook not_exist_hook_id not found/);
    });
  });

  describe('hook not belong to operator', () => {
    it('should throw error', async () => {
      await assert.rejects(async () => {
        await hookManageService.getHookByOwnerId(hook.hookId, 'not_exits_owner_id');
      }, new RegExp(`hook ${hook.hookId} not belong to not_exits_owner_id`));
    });
  });

  it('should work', async () => {
    const getHook = await hookManageService.getHookByOwnerId(hook.hookId, 'mock_owner_id');
    assert(getHook);
  });
});
