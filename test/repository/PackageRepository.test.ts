import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { PackageRepository } from '../../app/repository/PackageRepository.js';
import { PackageManagerService } from '../../app/core/service/PackageManagerService.js';
import { UserService } from '../../app/core/service/UserService.js';
import { TestUtil } from '../../test/TestUtil.js';
import { setTimeout } from 'node:timers/promises';

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
      const { packageCount, packageVersionCount } =
        await packageRepository.queryTotal();
      const { user } = await userService.create({
        name: 'test-user',
        password: 'this-is-password',
        email: 'hello@example.com',
        ip: '127.0.0.1',
      });
      await packageManagerService.publish(
        {
          dist: {
            content: Buffer.alloc(0),
          },
          tags: [''],
          scope: '',
          name: 'foo',
          description: 'foo description',
          packageJson: await TestUtil.getFullPackage({ name: 'foo' }),
          readme: '',
          version: '1.0.0',
          isPrivate: true,
        },
        user
      );
      await setTimeout(1000);
      const res = await packageRepository.queryTotal();
      assert(res.packageCount >= packageCount);
      assert(res.packageVersionCount > packageVersionCount);
    });
  });
});
