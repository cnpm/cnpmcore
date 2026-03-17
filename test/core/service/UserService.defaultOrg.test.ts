import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../TestUtil';
import { OrgRepository } from '../../../app/repository/OrgRepository';
import { UserRepository } from '../../../app/repository/UserRepository';

describe('test/core/service/UserService.defaultOrg.test.ts', () => {
  let adminUser: any;
  let orgRepository: OrgRepository;
  let userRepository: UserRepository;

  beforeEach(async () => {
    orgRepository = await app.getEggObject(OrgRepository);
    userRepository = await app.getEggObject(UserRepository);
    adminUser = await TestUtil.createAdmin();
  });

  describe('Feature 2: Auto-assign to default org on user creation', () => {
    it('should not trigger org logic when defaultOrg is empty', async () => {
      mock(app.config.cnpmcore, 'defaultOrg', '');
      const user = await TestUtil.createUser({ name: 'no-default-org-user' });
      assert(user.name === 'no-default-org-user');
    });

    it('should assign new user to default org when org exists', async () => {
      // Create org via HTTP API
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'mycompany', description: 'Test company' })
        .expect(200);

      const org = await orgRepository.findOrgByName('mycompany');
      assert(org);

      mock(app.config.cnpmcore, 'defaultOrg', 'mycompany');

      // Create user — should be auto-assigned
      const user = await TestUtil.createUser({ name: 'auto-org-user' });
      assert(user.name === 'auto-org-user');

      // Look up real userId
      const userEntity = await userRepository.findUserByName(user.name);
      assert(userEntity);

      // Verify membership
      const member = await orgRepository.findMember(org.orgId, userEntity.userId);
      assert(member, 'user should be a member of the default org');
      assert.equal(member.role, 'member');
    });

    it('should still create user when defaultOrg does not exist', async () => {
      app.mockLog();
      mock(app.config.cnpmcore, 'defaultOrg', 'nonexistent-org');

      const user = await TestUtil.createUser({ name: 'fallback-user' });
      assert(user.name === 'fallback-user');

      app.expectLog(/defaultOrg "nonexistent-org" not found/);
    });
  });
});
