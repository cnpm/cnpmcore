import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { PackageRepository, PackageManifestType } from '../../../../app/repository/PackageRepository';
import { PackageVersionBlockRepository } from '../../../../app/repository/PackageVersionBlockRepository';
import { getScopeAndName } from '../../../../app/common/PackageUtil';

describe('test/core/service/PackageManagerService/block.test.ts', () => {
  let packageManagerService: PackageManagerService;
  let packageRepository: PackageRepository;
  let packageVersionBlockRepository: PackageVersionBlockRepository;

  beforeEach(async () => {
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageRepository = await app.getEggObject(PackageRepository);
    packageVersionBlockRepository = await app.getEggObject(PackageVersionBlockRepository);
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  describe('block()', () => {
    it('should work with name', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const blockRes = await packageManagerService.blockPackageByFullname(pkgManifest.name, 'xxx');
      assert(blockRes.packageVersionBlockId);

      assert.doesNotReject(packageManagerService.unblockPackageByFullname(pkgManifest.name || ''));
    });
  });

  describe('blockPackageVersion()', () => {
    beforeEach(() => {
      mock(app.config.cnpmcore, 'enableBlockPackageVersion', true);
    });

    it('should block specific version', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      const block = await packageManagerService.blockPackageVersion(
        pkg,
        version,
        'Contains malicious code',
      );
      assert(block.packageVersionBlockId);
      assert.equal(block.version, version);
      assert.equal(block.reason, 'Contains malicious code');
    });

    it('should update reason when blocking same version again', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      await packageManagerService.blockPackageVersion(pkg, version, 'First reason');
      const block = await packageManagerService.blockPackageVersion(pkg, version, 'Updated reason');

      assert.equal(block.reason, 'Updated reason');
    });

    it('should throw error when version not found', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);

      await assert.rejects(
        async () => await packageManagerService.blockPackageVersion(pkg, '999.999.999', 'test'),
        /Version 999.999.999 not found/,
      );
    });

    it('should throw error when package-level block exists', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      // Block at package level first
      await packageManagerService.blockPackage(pkg, 'Package blocked');

      // Try to block specific version
      await assert.rejects(
        async () => await packageManagerService.blockPackageVersion(pkg, version, 'test'),
        /already blocked at package-level/,
      );
    });

    it('should unblock specific version', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      await packageManagerService.blockPackageVersion(pkg, version, 'test');
      await packageManagerService.unblockPackageVersion(pkg, version);

      const checkResult = await packageVersionBlockRepository.isVersionBlocked(pkg.packageId, version);
      assert.equal(checkResult.blocked, false);
    });

    it('should update blockVersions in manifest', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);

      await packageManagerService.blockPackageVersion(pkg, '1.0.0', 'test reason');

      // Check manifest contains blockVersions
      const { data } = await packageManagerService.listPackageFullManifests(scope, name);
      assert(data);
      assert(data.blockVersions);
      assert.equal(data.blockVersions['1.0.0'], 'test reason');
    });
  });

  describe('isVersionBlocked()', () => {
    beforeEach(() => {
      mock(app.config.cnpmcore, 'enableBlockPackageVersion', true);
    });

    it('should return package-level block', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      await packageManagerService.blockPackage(pkg, 'Package blocked');

      const result = await packageVersionBlockRepository.isVersionBlocked(pkg.packageId, version);
      assert.equal(result.blocked, true);
      assert.equal(result.version, '*');
      assert.equal(result.reason, 'Package blocked');
    });

    it('should return version-level block', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      await packageManagerService.blockPackageVersion(pkg, version, 'Version blocked');

      const result = await packageVersionBlockRepository.isVersionBlocked(pkg.packageId, version);
      assert.equal(result.blocked, true);
      assert.equal(result.version, version);
      assert.equal(result.reason, 'Version blocked');
    });

    it('should return not blocked', async () => {
      app.mockLog();
      const { pkg: pkgManifest } = await TestUtil.createPackage({ isPrivate: false });
      const [ scope, name ] = getScopeAndName(pkgManifest.name);
      const pkg = await packageRepository.findPackage(scope, name);
      assert(pkg);
      const version = (pkgManifest as unknown as PackageManifestType)['dist-tags'].latest;

      const result = await packageVersionBlockRepository.isVersionBlocked(pkg.packageId, version);
      assert.equal(result.blocked, false);
    });
  });
});
