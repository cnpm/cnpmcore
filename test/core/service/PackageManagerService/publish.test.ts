import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { UserService } from '../../../../app/core/service/UserService';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { TestUtil } from '../../../TestUtil';

describe('test/core/service/PackageManagerService/publish.test.ts', () => {
  let ctx: Context;
  let packageManagerService: PackageManagerService;
  let userService: UserService;
  let packageRepository: PackageRepository;
  let publisher;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    userService = await ctx.getEggObject(UserService);
    packageManagerService = await ctx.getEggObject(PackageManagerService);
    packageRepository = await ctx.getEggObject(PackageRepository);

    const { user } = await userService.create({
      name: 'test-user',
      password: 'this-is-password',
      email: 'hello@example.com',
      ip: '127.0.0.1',
    });
    publisher = user;
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  describe('publish()', () => {
    it('should work with dist.content', async () => {
      const { packageId } = await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tag: '',
        scope: '',
        name: 'foo',
        description: 'foo description',
        packageJson: {},
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
        tag: '',
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
    });

    it('should work with dist.localFile', async () => {
      const { packageId } = await packageManagerService.publish({
        dist: {
          localFile: TestUtil.getFixtures('pedding-1.1.0.tgz'),
        },
        tag: '',
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
