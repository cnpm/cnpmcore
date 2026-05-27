import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../test/TestUtil';
import { PackageManagerService } from '../../app/core/service/PackageManagerService';
import { PackageVersionBlockRepository } from '../../app/repository/PackageVersionBlockRepository';
import { PackageVersionBlock as PackageVersionBlockModel } from '../../app/repository/model/PackageVersionBlock';
import { UserService } from '../../app/core/service/UserService';
import { getScopeAndName } from '../../app/common/PackageUtil';

const DispatcherPath = require.resolve('../../app/port/schedule/BufferReleaseDispatcher');
const WorkerPath = require.resolve('../../app/port/schedule/BufferReleaseWorker');

describe('test/schedule/BufferRelease.test.ts', () => {
  let packageManagerService: PackageManagerService;
  let packageVersionBlockRepository: PackageVersionBlockRepository;
  let userService: UserService;
  let publisher;

  beforeEach(async () => {
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageVersionBlockRepository = await app.getEggObject(PackageVersionBlockRepository);
    userService = await app.getEggObject(UserService);
    const { user } = await userService.create({
      name: 'test-user', password: 'this-is-password', email: 'hello@example.com', ip: '127.0.0.1',
    });
    publisher = user;
    mock(app.config.cnpmcore, 'enableBlockPackageVersion', true);
    mock(app.config.cnpmcore, 'enableDependencyIsolation', true);
    mock(app.config.cnpmcore, 'dependencyIsolationDuration', 6 * 3600 * 1000);
    mock(app.config.cnpmcore, 'dependencyIsolationExclude', []);
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  async function publishIsolated(name: string, version: string) {
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
      isPrivate: false,
    }, publisher);
  }

  it('dispatcher enqueues expired buffer versions and worker releases them', async () => {
    const { packageId } = await publishIsolated('foo', '1.0.0');
    // hidden while buffered
    assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);
    // backdate expiry so it is due
    await PackageVersionBlockModel.update({ packageId, version: '1.0.0' }, { expiredAt: new Date(Date.now() - 1000) });

    await app.runSchedule(DispatcherPath);
    await app.runSchedule(WorkerPath);

    // released: block gone + version visible again
    assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
    assert((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0']);
  });

  it('should NOT release a buffer version before it expires', async () => {
    const { packageId } = await publishIsolated('foo', '1.0.0'); // expiredAt = now + 6h

    await app.runSchedule(DispatcherPath);
    await app.runSchedule(WorkerPath);

    // still buffered + hidden
    assert((await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'))?.isBuffer);
    assert.equal((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0'], undefined);
  });

  it('should still release already-buffered versions after the flag is turned off (rollback)', async () => {
    const { packageId } = await publishIsolated('foo', '1.0.0'); // buffered while flag on
    await PackageVersionBlockModel.update({ packageId, version: '1.0.0' }, { expiredAt: new Date(Date.now() - 1000) });
    // operator disables the feature (rollback) — existing buffer rows must still drain
    mock(app.config.cnpmcore, 'enableDependencyIsolation', false);

    await app.runSchedule(DispatcherPath);
    await app.runSchedule(WorkerPath);

    assert.equal(await packageVersionBlockRepository.findPackageVersionBlockExact(packageId, '1.0.0'), null);
    assert((await packageManagerService.listPackageFullManifests('', 'foo')).data?.versions['1.0.0']);
  });
});
