import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../test/TestUtil';
import { getScopeAndName } from '../../../app/common/PackageUtil';
import { PackageRepository } from '../../../app/repository/PackageRepository';

describe('test/core/event/StoreManifest.test.ts', () => {
  let packageRepository: PackageRepository;

  beforeEach(async () => {
    packageRepository = await app.getEggObject(PackageRepository);
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
      const { pkg, user } = await TestUtil.createPackage({ version: '1.0.0', readme: 'test store manifest' });
      let eventWaiter = await app.getEventWaiter();
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
      assert(packageVersionManifest.manifest.version === '1.0.0');
      // console.log(packageVersionManifest.manifest);

      await TestUtil.createPackage({ version: '2.0.0', readme: 'test store manifest' },
        { name: user.name, password: user.password });
      eventWaiter = await app.getEventWaiter();
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      const packageVersion2 = await packageRepository.findPackageVersion(packageId, '2.0.0');
      assert(packageVersion2);
      const packageVersionManifest2 = await packageRepository.findPackageVersionManifest(packageVersion2.packageVersionId);
      assert(packageVersionManifest2);
      assert(packageVersionManifest2.manifest.version === '2.0.0');
      // console.log(packageVersionManifest2.manifest);

      // should work same version
      (await app.getEventbus()).emit('PACKAGE_VERSION_ADDED', pkg.name, '2.0.0');
      eventWaiter = await app.getEventWaiter();
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      app.notExpectLog('[EventBus] process event PACKAGE_VERSION_ADDED failed: ER_DUP_ENTRY: Duplicate entry');
    });
  });
});
