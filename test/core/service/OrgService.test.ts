import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { OrgService } from '../../../app/core/service/OrgService.ts';
import { TeamService } from '../../../app/core/service/TeamService.ts';
import { OrgRepository } from '../../../app/repository/OrgRepository.ts';
import { TeamRepository } from '../../../app/repository/TeamRepository.ts';
import { UserRepository } from '../../../app/repository/UserRepository.ts';
import { TestUtil } from '../../TestUtil.ts';

describe('test/core/service/OrgService.test.ts', () => {
  let orgService: OrgService;
  let teamService: TeamService;
  let teamRepository: TeamRepository;
  let orgRepository: OrgRepository;
  let userRepository: UserRepository;

  beforeEach(async () => {
    orgService = await app.getEggObject(OrgService);
    teamService = await app.getEggObject(TeamService);
    teamRepository = await app.getEggObject(TeamRepository);
    orgRepository = await app.getEggObject(OrgRepository);
    userRepository = await app.getEggObject(UserRepository);
  });

  describe('createOrg()', () => {
    it('should create org with developers team and owner', async () => {
      const user = await TestUtil.createUser({ name: 'org-creator' });
      const creator = await userRepository.findUserByName(user.name);
      assert(creator);

      const org = await orgService.createOrg({
        name: 'testorg',
        creatorUserId: creator.userId,
      });
      assert.equal(org.name, 'testorg');

      // developers team should be auto-created
      const devTeam = await teamRepository.findTeam(org.orgId, 'developers');
      assert(devTeam);
      assert.equal(devTeam.name, 'developers');

      // creator should be org owner
      const member = await orgRepository.findMember(org.orgId, creator.userId);
      assert(member);
      assert.equal(member.role, 'owner');

      // creator should be in developers team
      const teamMember = await teamRepository.findMember(devTeam.teamId, creator.userId);
      assert(teamMember);
    });

    it('should throw if org name already exists', async () => {
      const user = await TestUtil.createUser({ name: 'org-dup-creator' });
      const creator = await userRepository.findUserByName(user.name);
      assert(creator);

      await orgService.createOrg({ name: 'duporg', creatorUserId: creator.userId });
      await assert.rejects(orgService.createOrg({ name: 'duporg', creatorUserId: creator.userId }), /already exists/);
    });
  });

  describe('addMember()', () => {
    it('should add member to org and auto-join developers team', async () => {
      const creator = await TestUtil.createUser({ name: 'add-member-creator' });
      const creatorEntity = await userRepository.findUserByName(creator.name);
      assert(creatorEntity);

      const org = await orgService.createOrg({ name: 'addmemberorg', creatorUserId: creatorEntity.userId });

      const newUser = await TestUtil.createUser({ name: 'new-member' });
      const newUserEntity = await userRepository.findUserByName(newUser.name);
      assert(newUserEntity);

      await orgService.addMember(org.orgId, newUserEntity.userId);

      // should be org member
      const orgMember = await orgRepository.findMember(org.orgId, newUserEntity.userId);
      assert(orgMember);
      assert.equal(orgMember.role, 'member');

      // should be in developers team
      const devTeam = await teamRepository.findTeam(org.orgId, 'developers');
      assert(devTeam);
      const teamMember = await teamRepository.findMember(devTeam.teamId, newUserEntity.userId);
      assert(teamMember);
    });

    it('should update role if member already exists', async () => {
      const creator = await TestUtil.createUser({ name: 'role-update-creator' });
      const creatorEntity = await userRepository.findUserByName(creator.name);
      assert(creatorEntity);

      const org = await orgService.createOrg({ name: 'roleupdateorg', creatorUserId: creatorEntity.userId });

      const user2 = await TestUtil.createUser({ name: 'role-update-user' });
      const user2Entity = await userRepository.findUserByName(user2.name);
      assert(user2Entity);

      await orgService.addMember(org.orgId, user2Entity.userId, 'member');
      let member = await orgRepository.findMember(org.orgId, user2Entity.userId);
      assert.equal(member?.role, 'member');

      await orgService.addMember(org.orgId, user2Entity.userId, 'owner');
      member = await orgRepository.findMember(org.orgId, user2Entity.userId);
      assert.equal(member?.role, 'owner');
    });
  });

  describe('removeMember()', () => {
    it('should remove member from org and all teams', async () => {
      const creator = await TestUtil.createUser({ name: 'rm-member-creator' });
      const creatorEntity = await userRepository.findUserByName(creator.name);
      assert(creatorEntity);

      const org = await orgService.createOrg({ name: 'rmmemberorg', creatorUserId: creatorEntity.userId });

      const user2 = await TestUtil.createUser({ name: 'rm-target' });
      const user2Entity = await userRepository.findUserByName(user2.name);
      assert(user2Entity);

      await orgService.addMember(org.orgId, user2Entity.userId);

      // Create a custom team and add user2
      const customTeam = await teamService.createTeam(org.orgId, 'custom-team');
      await teamService.addMember(customTeam.teamId, user2Entity.userId);

      // Verify user2 is in both teams
      const devTeam = await teamRepository.findTeam(org.orgId, 'developers');
      assert(devTeam);
      assert(await teamRepository.findMember(devTeam.teamId, user2Entity.userId));
      assert(await teamRepository.findMember(customTeam.teamId, user2Entity.userId));

      // Remove from org
      await orgService.removeMember(org.orgId, user2Entity.userId);

      // Should be gone from org and all teams
      assert.equal(await orgRepository.findMember(org.orgId, user2Entity.userId), null);
      assert.equal(await teamRepository.findMember(devTeam.teamId, user2Entity.userId), null);
      assert.equal(await teamRepository.findMember(customTeam.teamId, user2Entity.userId), null);
    });
  });

  describe('removeOrg()', () => {
    it('should cascade delete everything', async () => {
      const creator = await TestUtil.createUser({ name: 'rm-org-creator' });
      const creatorEntity = await userRepository.findUserByName(creator.name);
      assert(creatorEntity);

      const org = await orgService.createOrg({ name: 'rmorg', creatorUserId: creatorEntity.userId });
      const devTeam = await teamRepository.findTeam(org.orgId, 'developers');
      assert(devTeam);

      await orgService.removeOrg(org.orgId);

      assert.equal(await orgRepository.findOrgByOrgId(org.orgId), null);
      assert.equal(await teamRepository.findTeam(org.orgId, 'developers'), null);
      assert.equal(await orgRepository.findMember(org.orgId, creatorEntity.userId), null);
    });
  });
});
