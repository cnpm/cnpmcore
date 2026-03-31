import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { OrgService } from '../../../app/core/service/OrgService.ts';
import { TeamService } from '../../../app/core/service/TeamService.ts';
import { PackageRepository } from '../../../app/repository/PackageRepository.ts';
import { TeamRepository } from '../../../app/repository/TeamRepository.ts';
import { UserRepository } from '../../../app/repository/UserRepository.ts';
import { TestUtil } from '../../TestUtil.ts';

describe('test/core/service/TeamService.test.ts', () => {
  let orgService: OrgService;
  let teamService: TeamService;
  let teamRepository: TeamRepository;
  let userRepository: UserRepository;
  let packageRepository: PackageRepository;
  let orgId: string;
  let creatorUserId: string;

  beforeEach(async () => {
    orgService = await app.getEggObject(OrgService);
    teamService = await app.getEggObject(TeamService);
    teamRepository = await app.getEggObject(TeamRepository);
    userRepository = await app.getEggObject(UserRepository);
    packageRepository = await app.getEggObject(PackageRepository);

    const creator = await TestUtil.createUser({ name: 'team-test-creator' });
    const creatorEntity = await userRepository.findUserByName(creator.name);
    assert(creatorEntity);
    creatorUserId = creatorEntity.userId;

    const org = await orgService.createOrg({ name: 'teamtestorg', creatorUserId });
    orgId = org.orgId;
  });

  describe('createTeam()', () => {
    it('should create a team', async () => {
      const team = await teamService.createTeam(orgId, 'frontend');
      assert.equal(team.name, 'frontend');
      assert.equal(team.orgId, orgId);
    });

    it('should throw if team name already exists', async () => {
      await teamService.createTeam(orgId, 'dup-team');
      await assert.rejects(
        teamService.createTeam(orgId, 'dup-team'),
        /already exists/,
      );
    });
  });

  describe('removeTeam()', () => {
    it('should remove a custom team', async () => {
      const team = await teamService.createTeam(orgId, 'to-delete');
      await teamService.removeTeam(team.teamId);
      assert.equal(await teamRepository.findTeamByTeamId(team.teamId), null);
    });

    it('should not allow deleting developers team', async () => {
      const devTeam = await teamRepository.findTeam(orgId, 'developers');
      assert(devTeam);
      await assert.rejects(
        teamService.removeTeam(devTeam.teamId),
        /Cannot delete the developers team/,
      );
    });
  });

  describe('addMember()', () => {
    it('should add org member to team', async () => {
      const team = await teamService.createTeam(orgId, 'core');
      // creator is already an org member
      const member = await teamService.addMember(team.teamId, creatorUserId);
      assert(member);
      assert.equal(member.teamId, team.teamId);
    });

    it('should reject non-org-member', async () => {
      const team = await teamService.createTeam(orgId, 'restricted');
      const outsider = await TestUtil.createUser({ name: 'outsider' });
      const outsiderEntity = await userRepository.findUserByName(outsider.name);
      assert(outsiderEntity);

      await assert.rejects(
        teamService.addMember(team.teamId, outsiderEntity.userId),
        /must be an org member/,
      );
    });

    it('should be idempotent', async () => {
      const team = await teamService.createTeam(orgId, 'idempotent-team');
      await teamService.addMember(team.teamId, creatorUserId);
      const second = await teamService.addMember(team.teamId, creatorUserId);
      assert(second);
    });
  });

  describe('removeMember()', () => {
    it('should remove member from team', async () => {
      const team = await teamService.createTeam(orgId, 'rm-team');
      await teamService.addMember(team.teamId, creatorUserId);
      await teamService.removeMember(team.teamId, creatorUserId);
      const member = await teamRepository.findMember(team.teamId, creatorUserId);
      assert.equal(member, null);
    });
  });

  describe('grantPackageAccess() / revokePackageAccess()', () => {
    it('should grant and revoke package access', async () => {
      const { pkg } = await TestUtil.createPackage({
        name: '@cnpm/test-pkg',
        version: '1.0.0',
      });
      const [ scope, name ] = pkg.name.split('/');
      const pkgEntity = await packageRepository.findPackage(scope, name);
      assert(pkgEntity);

      const team = await teamService.createTeam(orgId, 'pkg-team');

      // Grant
      await teamService.grantPackageAccess(team.teamId, pkgEntity.packageId);
      let packages = await teamService.listPackages(team.teamId);
      assert.equal(packages.length, 1);
      assert.equal(packages[0].packageId, pkgEntity.packageId);

      // Idempotent
      await teamService.grantPackageAccess(team.teamId, pkgEntity.packageId);
      packages = await teamService.listPackages(team.teamId);
      assert.equal(packages.length, 1);

      // Revoke
      await teamService.revokePackageAccess(team.teamId, pkgEntity.packageId);
      packages = await teamService.listPackages(team.teamId);
      assert.equal(packages.length, 0);
    });
  });

  describe('listMembers()', () => {
    it('should list team members', async () => {
      const team = await teamService.createTeam(orgId, 'list-members-team');
      await teamService.addMember(team.teamId, creatorUserId);

      const user2 = await TestUtil.createUser({ name: 'list-member-2' });
      const user2Entity = await userRepository.findUserByName(user2.name);
      assert(user2Entity);
      await orgService.addMember(orgId, user2Entity.userId);
      await teamService.addMember(team.teamId, user2Entity.userId);

      const members = await teamService.listMembers(team.teamId);
      assert.equal(members.length, 2);
      const userIds = members.map(m => m.userId);
      assert(userIds.includes(creatorUserId));
      assert(userIds.includes(user2Entity.userId));
    });
  });

  describe('listTeamsByUserId()', () => {
    it('should list teams the user belongs to', async () => {
      // creator is in developers by default
      const teams = await teamRepository.listTeamsByUserId(creatorUserId);
      assert(teams.length >= 1);
      assert(teams.some(t => t.name === 'developers'));

      // add to a custom team
      const customTeam = await teamService.createTeam(orgId, 'custom');
      await teamService.addMember(customTeam.teamId, creatorUserId);

      const teams2 = await teamRepository.listTeamsByUserId(creatorUserId);
      assert.equal(teams2.length, 2);
      const names = teams2.map(t => t.name);
      assert(names.includes('developers'));
      assert(names.includes('custom'));
    });

    it('should return empty for user with no teams', async () => {
      const outsider = await TestUtil.createUser({ name: 'no-team-user' });
      const outsiderEntity = await userRepository.findUserByName(outsider.name);
      assert(outsiderEntity);
      const teams = await teamRepository.listTeamsByUserId(outsiderEntity.userId);
      assert.equal(teams.length, 0);
    });
  });

  describe('hasPackageAccess()', () => {
    it('should return true when user is in a team with package access', async () => {
      const { pkg } = await TestUtil.createPackage({
        name: '@cnpm/access-pkg',
        version: '1.0.0',
      });
      const [ scope, name ] = pkg.name.split('/');
      const pkgEntity = await packageRepository.findPackage(scope, name);
      assert(pkgEntity);

      const team = await teamService.createTeam(orgId, 'access-team');
      await teamService.addMember(team.teamId, creatorUserId);
      await teamService.grantPackageAccess(team.teamId, pkgEntity.packageId);

      const hasAccess = await teamRepository.hasPackageAccess(pkgEntity.packageId, creatorUserId);
      assert.equal(hasAccess, true);
    });

    it('should return false when user is not in any authorized team', async () => {
      const { pkg } = await TestUtil.createPackage({
        name: '@cnpm/noaccess-pkg',
        version: '1.0.0',
      });
      const [ scope, name ] = pkg.name.split('/');
      const pkgEntity = await packageRepository.findPackage(scope, name);
      assert(pkgEntity);

      const outsider = await TestUtil.createUser({ name: 'no-access-user' });
      const outsiderEntity = await userRepository.findUserByName(outsider.name);
      assert(outsiderEntity);

      const team = await teamService.createTeam(orgId, 'noaccess-team');
      await teamService.grantPackageAccess(team.teamId, pkgEntity.packageId);

      const hasAccess = await teamRepository.hasPackageAccess(pkgEntity.packageId, outsiderEntity.userId);
      assert.equal(hasAccess, false);
    });

    it('should return false when no team has package access', async () => {
      const hasAccess = await teamRepository.hasPackageAccess('nonexistent-pkg-id', creatorUserId);
      assert.equal(hasAccess, false);
    });
  });
});
