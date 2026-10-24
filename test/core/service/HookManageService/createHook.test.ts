import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { HookType } from '../../../../app/common/enum/Hook.ts';
import { HookManageService } from '../../../../app/core/service/HookManageService.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/core/service/HookManageService/createHook.test.ts', () => {
  let hookManageService: HookManageService;

  beforeEach(async () => {
    hookManageService = await app.getEggObject(HookManageService);
  });

  afterEach(async () => {
    await TestUtil.truncateDatabase();
    await mock.restore();
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
    assert.ok(hook);
    assert.ok(hook.enable === true);
  });

  describe('private network endpoints', () => {
    let seq = 0;
    const create = (endpoint: string) =>
      hookManageService.createHook({
        type: HookType.Package,
        ownerId: 'mock_owner_id',
        name: `foo_package_${seq++}`,
        endpoint,
        secret: 'mock_secret',
      });

    it('should reject by default', async () => {
      await assert.rejects(create('http://10.0.0.5/hook'), /private or loopback/);
      await assert.rejects(create('http://jenkins.corp.internal/hook'), /hostname is not allowed/);
    });

    it('should allow when hookAllowPrivateNetwork is enabled', async () => {
      mock(app.config.cnpmcore, 'hookAllowPrivateNetwork', true);
      const hook = await create('http://10.0.0.5/hook');
      assert.equal(hook.endpoint, 'http://10.0.0.5/hook');
      await assert.rejects(create('file:///etc/passwd'), /http or https/);
    });

    it('should allow hookAllowedHosts and hookAllowedCIDRs targets', async () => {
      mock(app.config.cnpmcore, 'hookAllowedHosts', ['jenkins.corp.internal']);
      mock(app.config.cnpmcore, 'hookAllowedCIDRs', ['10.0.0.0/24']);
      assert.ok(await create('http://jenkins.corp.internal/hook'));
      assert.ok(await create('http://10.0.0.5/hook'));
      await assert.rejects(create('http://10.0.1.5/hook'), /private or loopback/);
      await assert.rejects(create('http://other.corp.internal/hook'), /hostname is not allowed/);
    });
  });
});
