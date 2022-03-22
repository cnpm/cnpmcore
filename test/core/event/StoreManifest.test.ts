import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { TestUtil } from 'test/TestUtil';
import { getScopeAndName } from 'app/common/PackageUtil';
import { PackageRepository } from 'app/repository/PackageRepository';

describe('test/core/event/StoreManifest.test.ts', () => {
  let ctx: Context;
  let packageRepository: PackageRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageRepository = await ctx.getEggObject(PackageRepository);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('savePackageVersionManifest()', () => {
    it('should not store manifest when enableStoreFullPackageVersionManifestsToDatabase = false', async () => {
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0' });
      const eventWaiter = await app.getEventWaiter();
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      const [ scope, name ] = getScopeAndName(pkg.name);
      const packageId = await packageRepository.findPackageId(scope, name);
      assert(packageId);
      const packageVersion = await packageRepository.findPackageVersion(packageId, '1.0.0');
      assert(packageVersion);
      const packageVersionManifest = await packageRepository.findPackageVersionManifest(packageVersion.packageVersionId);
      assert(!packageVersionManifest);
      app.notExpectLog('[PackageRepository:savePackageVersionManifest:new] id: ');
    });

    it('should store manifest when enableStoreFullPackageVersionManifestsToDatabase = true', async () => {
      mock(app.config.cnpmcore, 'enableStoreFullPackageVersionManifestsToDatabase', true);
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0', readme: 'test store manifest' });
      const eventWaiter = await app.getEventWaiter();
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      const [ scope, name ] = getScopeAndName(pkg.name);
      const packageId = await packageRepository.findPackageId(scope, name);
      assert(packageId);
      const packageVersion = await packageRepository.findPackageVersion(packageId, '1.0.0');
      assert(packageVersion);
      const packageVersionManifest = await packageRepository.findPackageVersionManifest(packageVersion.packageVersionId);
      assert(packageVersionManifest);
      app.expectLog('[PackageRepository:savePackageVersionManifest:new] id: ');
      assert(packageVersionManifest.manifest.readme === 'test store manifest');
      assert(packageVersionManifest.manifest.description);
      // console.log(packageVersionManifest.manifest);
    });
  });
});
