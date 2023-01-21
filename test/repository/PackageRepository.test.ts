import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { PackageRepository } from 'app/repository/PackageRepository';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { UserService } from 'app/core/service/UserService';

describe('test/repository/PackageRepository.test.ts', () => {
  let packageRepository: PackageRepository;
  let packageManagerService: PackageManagerService
  let userService: UserService;

  describe('getCount', () => {
    beforeEach(async () => {
      packageRepository = await app.getEggObject(PackageRepository);
      packageManagerService = await app.getEggObject(PackageManagerService);
      userService = await app.getEggObject(UserService);
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
        packageJson: {},
        readme: '',
        version: '1.0.0',
        isPrivate: true,
      }, user);
    });
    it('should work', async () => {
      const res = await packageRepository.queryTotal();
      assert(res.packageCount === 1);
      assert(res.packageVersionCount === 1);
    });
  });
});
