import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { UserService } from '../../../../app/core/service/UserService';
import { PackageRepository } from '../../../../app/repository/PackageRepository';

describe('test/core/service/PackageManagerService/publish.test.ts', () => {
  let packageManagerService: PackageManagerService;
  let userService: UserService;
  let packageRepository: PackageRepository;
  let publisher;

  beforeEach(async () => {
    userService = await app.getEggObject(UserService);
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageRepository = await app.getEggObject(PackageRepository);

    const { user } = await userService.create({
      name: 'test-user',
      password: 'this-is-password',
      email: 'hello@example.com',
      ip: '127.0.0.1',
    });
    publisher = user;
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  describe('publish()', () => {
    it('should work with dist.content', async () => {
      app.mockLog();
      const { packageId } = await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tags: [ '' ],
        scope: '',
        name: 'foo',
        description: 'foo description',
        packageJson: await TestUtil.getFullPackage({ name: 'foo' }),
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      }, publisher);
      let pkgVersion = await packageRepository.findPackageVersion(packageId, '1.0.0');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.0.0');
      // another version
      await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tags: [ '' ],
        scope: '',
        name: 'foo',
        description: 'foo description new',
        packageJson: { name: 'foo', test: 'test', version: '1.0.0' },
        readme: '',
        version: '1.0.1',
        isPrivate: true,
      }, publisher);
      pkgVersion = await packageRepository.findPackageVersion(packageId, '1.0.1');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.0.1');
      // expect aop async timer
      // 2022-06-03 13:55:39,152 INFO 79813 [-/127.0.0.1/cb81b2f0-e301-11ec-94f3-bf6547f48233/112.523ms GET /] [0.311] [NFSAdapter:uploadBytes|T]
      app.expectLog(/\[\d+\.\d+\] \[NFSAdapter:uploadBytes|T\]/);
    });

    it('should work slice long description', async () => {
      app.mockLog();
      const { packageId } = await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tags: [ '' ],
        scope: '',
        name: 'foo',
        description: '~'.repeat(1100 * 100),
        packageJson: await TestUtil.getFullPackage({ name: 'foo' }),
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      }, publisher);
      const pkgVersion = await packageRepository.findPackageVersion(packageId, '1.0.0');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.0.0');
      const pkg = await packageRepository.findPackage('', 'foo');
      assert(pkg?.description === '~'.repeat(1024 * 10));
    });

    it('should work with dist.localFile', async () => {
      const { packageId } = await packageManagerService.publish({
        dist: {
          localFile: TestUtil.getFixtures('registry.npmjs.org/pedding/-/pedding-1.1.0.tgz'),
        },
        tags: [ '' ],
        scope: '',
        name: 'pedding',
        description: 'pedding description',
        packageJson: { name: 'pedding', test: 'test', version: '1.1.0' },
        readme: '',
        version: '1.1.0',
        isPrivate: false,
      }, publisher);
      const pkgVersion = await packageRepository.findPackageVersion(packageId, '1.1.0');
      assert(pkgVersion);
      assert.equal(pkgVersion.version, '1.1.0');
      assert.equal(pkgVersion.tarDist.size, 2672);
    });
  });
});
