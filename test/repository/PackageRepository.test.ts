import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { PackageRepository } from '../../app/repository/PackageRepository';
import { PackageManagerService } from '../../app/core/service/PackageManagerService';
import { UserService } from '../../app/core/service/UserService';
import { TestUtil } from '../../test/TestUtil';

describe('test/repository/PackageRepository.test.ts', () => {
  let packageRepository: PackageRepository;
  let packageManagerService: PackageManagerService;
  let userService: UserService;

  describe('queryTotal', () => {
    beforeEach(async () => {
      packageRepository = await app.getEggObject(PackageRepository);
      packageManagerService = await app.getEggObject(PackageManagerService);
      userService = await app.getEggObject(UserService);

    });
    it('should work', async () => {
      const { packageCount, packageVersionCount } = await packageRepository.queryTotal();
      const { user } = await userService.create({
        name: 'test-user',
        password: 'this-is-password',
        email: 'hello@example.com',
        ip: '127.0.0.1',
      });
      await packageManagerService.publish({
        dist: {
          content: Buffer.alloc(0),
        },
        tag: '',
        scope: '',
        name: 'foo',
        description: 'foo description',
        packageJson: await TestUtil.getFullPackage({ name: 'foo' }),
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      }, user);
      const res = await packageRepository.queryTotal();
      // information_schema 只能返回大概值，仅验证增加
      assert(res.packageCount > packageCount);
      assert(res.packageVersionCount > packageVersionCount);
    });
  });
});
