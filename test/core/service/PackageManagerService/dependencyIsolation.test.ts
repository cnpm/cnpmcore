import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { PackageVersionBlockRepository } from '../../../../app/repository/PackageVersionBlockRepository';
import { PackageVersionBlock, PACKAGE_VERSION_BLOCK_TYPE_BUFFER } from '../../../../app/core/entity/PackageVersionBlock';
import { UserService } from '../../../../app/core/service/UserService';
import { getScopeAndName } from '../../../../app/common/PackageUtil';

describe('test/core/service/PackageManagerService/dependencyIsolation.test.ts', () => {
  let packageManagerService: PackageManagerService;
  let packageRepository: PackageRepository;
  let packageVersionBlockRepository: PackageVersionBlockRepository;
  let userService: UserService;
  let publisher;

  beforeEach(async () => {
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageRepository = await app.getEggObject(PackageRepository);
    packageVersionBlockRepository = await app.getEggObject(PackageVersionBlockRepository);
    userService = await app.getEggObject(UserService);
    const { user } = await userService.create({
      name: 'test-user',
      password: 'this-is-password',
      email: 'hello@example.com',
      ip: '127.0.0.1',
    });
    publisher = user;
    // version-level block enforcement + isolation enabled
    mock(app.config.cnpmcore, 'enableBlockPackageVersion', true);
    mock(app.config.cnpmcore, 'enableDependencyIsolation', true);
    mock(app.config.cnpmcore, 'dependencyIsolationDuration', 6 * 3600 * 1000);
    mock(app.config.cnpmcore, 'dependencyIsolationExclude', []);
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  async function publishVersion(name: string, version: string, isPrivate: boolean) {
    const [ scope, pkgName ] = getScopeAndName(name);
    app.mockLog();
    return await packageManagerService.publish({
      dist: { content: Buffer.alloc(0) },
      tags: [ '' ],
      scope,
      name: pkgName,
      description: name,
      packageJson: await TestUtil.getFullPackage({ name, version }),
      readme: '',
      version,
      isPrivate,
    }, publisher);
  }

  describe('isolate new version on publish (C3/C7)', () => {
    it('should isolate a public (synced) version and hide it from the manifest', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', false);

      // a buffer block record is written
      const block = await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0');
      assert(block);
      assert.equal(block.type, PACKAGE_VERSION_BLOCK_TYPE_BUFFER);
      assert(block.isBuffer);
      assert(block.expiredAt instanceof Date);
      assert(block.expiredAt.getTime() > Date.now());

      // the version is invisible in the client manifest
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert(data);
      assert.equal(data.versions['1.0.0'], undefined);
      assert(data.blockVersions);
      assert.match(data.blockVersions['1.0.0'], /^\[buffer\]/);
    });

    it('should NOT isolate a private (user) publish', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const block = await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0');
      assert.equal(block, null);
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert(data?.versions['1.0.0']);
    });

    it('should NOT isolate when the package matches dependencyIsolationExclude', async () => {
      mock(app.config.cnpmcore, 'dependencyIsolationExclude', [ 'foo' ]);
      const { packageId } = await publishVersion('foo', '1.0.0', false);
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert(data?.versions['1.0.0']);
    });

    it('should match scope wildcard in dependencyIsolationExclude', async () => {
      mock(app.config.cnpmcore, 'dependencyIsolationExclude', [ '@scope/*' ]);
      const { packageId } = await publishVersion('@scope/foo', '1.0.0', false);
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
    });

    it('should NOT isolate when disabled', async () => {
      mock(app.config.cnpmcore, 'enableDependencyIsolation', false);
      const { packageId } = await publishVersion('foo', '1.0.0', false);
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert(data?.versions['1.0.0']);
    });

    it('should NOT isolate when duration <= 0', async () => {
      mock(app.config.cnpmcore, 'dependencyIsolationDuration', 0);
      const { packageId } = await publishVersion('foo', '1.0.0', false);
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
    });
  });

  describe('releaseBufferedVersions (C5)', () => {
    it('should release a buffer version and restore it to the manifest', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', false);
      assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);

      const released = await packageManagerService.releaseBufferedVersions(packageId, [ '1.0.0' ]);
      assert.deepEqual(released, [ '1.0.0' ]);

      // block record removed, version visible again
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert(data?.versions['1.0.0']);
    });

    it('should NOT release a version overwritten to a permanent block', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', false);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);

      // a decision source permanently blocks it during the buffer window
      const res = await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', false, '[security] malicious');
      assert.equal(res.changed, true);
      const block = await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0');
      assert(block);
      assert.equal(block.type, null);
      assert.equal(block.isBuffer, false);

      // release does nothing for it; version stays hidden
      const released = await packageManagerService.releaseBufferedVersions(packageId, [ '1.0.0' ]);
      assert.deepEqual(released, []);
      const { data } = await packageManagerService.listPackageFullManifests('', 'foo');
      assert.equal(data?.versions['1.0.0'], undefined);
      assert(data?.blockVersions);
      assert.equal(data.blockVersions['1.0.0'], '[security] malicious');
    });

    it('should be idempotent for unknown / already-released versions', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      assert.deepEqual(await packageManagerService.releaseBufferedVersions(packageId, [ '9.9.9' ]), []);
    });
  });

  describe('findExpiredBufferedVersions (C5)', () => {
    it('should return only buffer rows whose hold has expired', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const past = new Date(Date.now() - 1000);
      const future = new Date(Date.now() + 3600 * 1000);
      await packageVersionBlockRepository.savePackageVersionBlock(PackageVersionBlock.create({
        packageId, version: '2.0.0', reason: '[buffer] x', type: PACKAGE_VERSION_BLOCK_TYPE_BUFFER, expiredAt: past,
      }));
      await packageVersionBlockRepository.savePackageVersionBlock(PackageVersionBlock.create({
        packageId, version: '3.0.0', reason: '[buffer] y', type: PACKAGE_VERSION_BLOCK_TYPE_BUFFER, expiredAt: future,
      }));
      // a permanent (non-buffer) block is never returned
      await packageVersionBlockRepository.savePackageVersionBlock(PackageVersionBlock.create({
        packageId, version: '4.0.0', reason: 'manual',
      }));

      const expired = await packageVersionBlockRepository.findExpiredBufferedVersions(10);
      const versions = expired.map(b => b.version);
      assert(versions.includes('2.0.0'));
      assert(!versions.includes('3.0.0'));
      assert(!versions.includes('4.0.0'));
    });
  });

  describe('ensurePackageVersionAvailability (C2)', () => {
    it('should be a no-op when making an already-available version available', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);
      assert.deepEqual(await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', true), { changed: false });
    });

    it('should NOT release a buffered version (no automated escape from isolation)', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', false); // public -> isolated
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);
      // sanity: it is buffered + hidden
      assert((await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'))?.isBuffer);

      // an automated "make available" must NOT spring it out of the buffer
      const res = await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', true);
      assert.deepEqual(res, { changed: false });
      assert((await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'))?.isBuffer);
      assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);

      // but an admin force-unblock (the explicit escape channel) still releases it
      await packageManagerService.unblockPackageVersion(pkg, '1.0.0');
      assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
      assert((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0']);
    });

    it('should block then unblock idempotently', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);

      assert.deepEqual(await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', false, 'bad'), { changed: true });
      assert.deepEqual(await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', false, 'bad'), { changed: false });
      assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);

      assert.deepEqual(await packageManagerService.ensurePackageVersionAvailability(pkg, '1.0.0', true), { changed: true });
      assert(((await packageManagerService.listPackageFullManifests('', 'foo')).data)?.versions['1.0.0']);
    });
  });

  describe('block-aware incremental refresh (regression, PR #1058)', () => {
    it('should keep a blocked version out of the incremental manifest refresh', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);
      await packageManagerService.blockPackageVersion(pkg, '1.0.0', 'bad');
      assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);

      // incremental refresh (as run by sync batch / re-publish) must not re-add the blocked version
      await packageManagerService.refreshPackageChangeVersionsToDists(pkg, [ '1.0.0' ]);
      assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);
    });
  });

  describe('unblockPackageVersion event (re-emit on admission)', () => {
    it('should emit PACKAGE_VERSION_ADDED when a blocked version becomes visible again', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);
      await packageManagerService.blockPackageVersion(pkg, '1.0.0', 'bad');

      const emitted: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock((packageManagerService as any).eventBus, 'emit', (name: string) => { emitted.push(name); });
      await packageManagerService.unblockPackageVersion(pkg, '1.0.0');

      // version becomes visible again -> consumers that only listen to PACKAGE_VERSION_ADDED must be notified
      assert(emitted.includes('PACKAGE_VERSION_ADDED'));
      assert(emitted.includes('PACKAGE_UNBLOCKED'));
    });

    it('should NOT emit PACKAGE_VERSION_ADDED when there was no block to remove', async () => {
      const { packageId } = await publishVersion('foo', '1.0.0', true);
      const pkg = await packageRepository.findPackageByPackageId(packageId);
      assert(pkg);

      const emitted: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock((packageManagerService as any).eventBus, 'emit', (name: string) => { emitted.push(name); });
      await packageManagerService.unblockPackageVersion(pkg, '1.0.0');

      assert(!emitted.includes('PACKAGE_VERSION_ADDED'));
    });
  });
});
