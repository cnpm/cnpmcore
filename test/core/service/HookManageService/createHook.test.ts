import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { HookManageService } from '../../../../app/core/service/HookManageService';
import { TestUtil } from '../../../TestUtil';
import { HookType } from '../../../../app/common/enum/Hook';

describe('test/core/service/HookManageService/createHook.test.ts', () => {
  let ctx: Context;
  let hookManageService: HookManageService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    hookManageService = await ctx.getEggObject(HookManageService);
  });

  afterEach(async () => {
    await TestUtil.truncateDatabase();
    await app.destroyModuleContext(ctx);
    mock.restore();
  });

  describe('limit exceeded', () => {
    beforeEach(() => {
      mock(ctx.app.config.cnpmcore, 'hooksLimit', 0);
    });

    it('should throw error', async () => {
      await assert.rejects(async () => {
        await hookManageService.createHook({
          type: HookType.Package,
          ownerId: 'mock_owner_id',
          name: 'foo_package',
          endpoint: 'http://foo.com',
          secret: 'mock_secret',
        });
      }, /hooks limit exceeded/);
    });
  });

  it('should work', async () => {
    const hook = await hookManageService.createHook({
      type: HookType.Package,
      ownerId: 'mock_owner_id',
      name: 'foo_package',
      endpoint: 'http://foo.com',
      secret: 'mock_secret',
    });
    assert(hook);
    assert(hook.enable === true);
  });
});
