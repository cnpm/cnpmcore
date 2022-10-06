import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService';
import { TestUtil } from '../../../TestUtil';

describe('test/core/service/PackageSyncerService/createTask.test.ts', () => {
  let ctx: Context;
  const pkgName = '@cnpmcore/foo';
  const username = 'mock_username';
  let packageSyncerService: PackageSyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);

    await TestUtil.createPackage({
      name: pkgName,
      registryId: 'mock_registry_id',
      isPrivate: false,
    }, {
      name: username,
    });
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should ignore if registryId not same', async () => {
    await assert.rejects(async () => {
      await packageSyncerService.createTask(pkgName, {
        registryId: 'sync_registry_id',
      });
    }, /package @cnpmcore\/foo is not in registry sync_registry_id/);
  });

  it('should work when registryId is null', async () => {
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    await TestUtil.createPackage({
      name: 'binary-mirror-config',
      isPrivate: false,
    }, {
      name: username,
    });

    const task = await packageSyncerService.createTask('binary-mirror-config', {
      registryId: 'sync_registry_id',
    });
    assert(task);
  });

  it('should work when pkg not exists', async () => {
    const task = await packageSyncerService.createTask('binary-mirror-config-not-exists', {
      registryId: 'sync_registry_id',
    });
    assert(task);
  });
});
