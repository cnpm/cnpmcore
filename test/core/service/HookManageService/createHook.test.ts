import { strict as assert } from 'node:assert';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';
import { HookManageService } from '../../../../app/core/service/HookManageService.js';
import { HookType } from '../../../../app/common/enum/Hook.js';

describe('test/core/service/HookManageService/createHook.test.ts', () => {
  let hookManageService: HookManageService;

  beforeEach(async () => {
    hookManageService = await app.getEggObject(HookManageService);
  });

  afterEach(async () => {
    await TestUtil.truncateDatabase();
    mock.restore();
  });

  describe('limit exceeded', () => {
    beforeEach(() => {
      mock(app.config.cnpmcore, 'hooksLimit', 0);
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
