import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { DEVELOPERS_TEAM } from '../../../../app/common/constants.ts';
import { TeamPackage } from '../../../../app/core/entity/TeamPackage.ts';
import { OrgRepository } from '../../../../app/repository/OrgRepository.ts';
import { PackageRepository } from '../../../../app/repository/PackageRepository.ts';
import { TeamRepository } from '../../../../app/repository/TeamRepository.ts';
import { TestUtil } from '../../../TestUtil.ts';

describe('test/port/controller/TeamController/index.test.ts', () => {
  let adminUser: any;
  let normalUser: any;

  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    normalUser = await TestUtil.createUser({ name: 'team-ctrl-user' });

    // Create org for team tests (non-allowScopes org, requires admin)
    await app
      .httpRequest()
      .put('/-/org')
      .set('authorization', adminUser.authorization)
      .send({ name: 'teamorg' })
      .expect(200);
  });

  // ==================== createTeam ====================
  describe('[PUT /-/org/:orgName/team] createTeam()', () => {
    it('should 200 when admin creates team', async () => {
      const res = await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'frontend', description: 'Frontend team' })
        .expect(200);
      assert(res.body.ok);
    });

    it('should auto-add creator as team owner', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'owned-team' })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/owned-team/member')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((m: any) => m.user === adminUser.displayName && m.role === 'owner'));
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().put('/-/org/teamorg/team').send({ name: 'no-auth-team' }).expect(401);
    });

    it('should 403 when non-owner creates team in non-allowScopes org', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'backend' })
        .expect(403);
    });

    it('should allow org owner to create team', async () => {
      const ownerUser = await TestUtil.createUser({ name: 'org-owner-user' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: ownerUser.name, role: 'owner' })
        .expect(200);

      const res = await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', ownerUser.authorization)
        .send({ name: 'owner-created-team' })
        .expect(200);
      assert(res.body.ok);
    });

    it('should 422 when name is missing', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 403 when team name already exists', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'dup-team' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'dup-team' })
        .expect(403);
    });

    it('should 404 when non-allowScopes org not found', async () => {
      await app
        .httpRequest()
        .put('/-/org/nonexistent-org/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'some-team' })
        .expect(404);
    });
  });

  // ==================== listTeams ====================
  describe('[GET /-/org/:orgName/team] listTeams()', () => {
    it('should list teams including developers', async () => {
      const res = await app
        .httpRequest()
        .get('/-/org/teamorg/team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes('teamorg:developers'));
    });

    it('should list multiple teams', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'frontend' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'backend' })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/org/teamorg/team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(res.body.includes('teamorg:developers'));
      assert(res.body.includes('teamorg:frontend'));
      assert(res.body.includes('teamorg:backend'));
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().get('/-/org/teamorg/team').expect(401);
    });

    it('should 404 when non-allowScopes org not found', async () => {
      await app
        .httpRequest()
        .get('/-/org/nonexistent-org/team')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  // ==================== showTeam ====================
  describe('[GET /-/team/:orgName/:teamName] showTeam()', () => {
    it('should 200 and return team info', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'show-team', description: 'A test team' })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/show-team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body.name, 'show-team');
      assert.equal(res.body.description, 'A test team');
      assert(res.body.created);
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().get('/-/team/teamorg/developers').expect(401);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/teamorg/nonexistent')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });

    it('should 404 when org not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/nonexistent-org/some-team')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  // ==================== removeTeam ====================
  describe('[DELETE /-/team/:orgName/:teamName] removeTeam()', () => {
    it('should 200 for custom team by admin', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'to-delete' })
        .expect(200);

      const res = await app
        .httpRequest()
        .delete('/-/team/teamorg/to-delete')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(res.body.ok);

      // Verify team is gone
      await app
        .httpRequest()
        .get('/-/team/teamorg/to-delete')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });

    it('should allow team owner to delete own team', async () => {
      // Create team in allowScopes org — normalUser becomes owner
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'owner-delete-team' })
        .expect(200);

      const res = await app
        .httpRequest()
        .delete('/-/team/cnpm/owner-delete-team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when deleting developers team', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers')
        .set('authorization', adminUser.authorization)
        .expect(403);
    });

    it('should 403 when non-owner tries to delete', async () => {
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'protected-team' })
        .expect(200);

      const anotherUser = await TestUtil.createUser({ name: 'delete-attacker' });
      await app
        .httpRequest()
        .delete('/-/team/cnpm/protected-team')
        .set('authorization', anotherUser.authorization)
        .expect(403);
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().delete('/-/team/teamorg/developers').expect(401);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/nonexistent')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });
  });

  // ==================== listTeamMembers (npm compatible) ====================
  describe('[GET /-/team/:orgName/:teamName/user] listTeamMembers()', () => {
    it('should return string array (npm compatible)', async () => {
      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      // admin is auto-added to developers on org creation
      assert(res.body.includes(adminUser.displayName));
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().get('/-/team/teamorg/developers/user').expect(401);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/teamorg/nonexistent/user')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });

    it('should 404 when org not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/nonexistent-org/some-team/user')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  // ==================== listTeamMembersWithRole (private) ====================
  describe('[GET /-/team/:orgName/:teamName/member] listTeamMembersWithRole()', () => {
    it('should return [{user, role}]', async () => {
      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((m: any) => m.user === adminUser.displayName && m.role === 'owner'));
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().get('/-/team/teamorg/developers/member').expect(401);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/teamorg/nonexistent/member')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });

    it('should 404 when org not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/nonexistent-org/some-team/member')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  // ==================== updateTeamMemberRole (PATCH) ====================
  describe('[PATCH /-/team/:orgName/:teamName/member/:username] updateTeamMemberRole()', () => {
    beforeEach(async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'role-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/role-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);
    });

    it('should promote member to owner', async () => {
      const res = await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);
      assert(res.body.ok);

      const members = await app
        .httpRequest()
        .get('/-/team/teamorg/role-team/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(members.body.some((m: any) => m.user === normalUser.displayName && m.role === 'owner'));
    });

    it('should demote owner to member', async () => {
      // Promote first
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      // Demote
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'member' })
        .expect(200);

      const members = await app
        .httpRequest()
        .get('/-/team/teamorg/role-team/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(members.body.some((m: any) => m.user === normalUser.displayName && m.role === 'member'));
    });

    it('should 401 without authorization', async () => {
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .send({ role: 'owner' })
        .expect(401);
    });

    it('should 403 when non-owner tries to update role', async () => {
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', normalUser.authorization)
        .send({ role: 'owner' })
        .expect(403);
    });

    it('should 422 when role is missing', async () => {
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 422 when role is invalid', async () => {
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'admin' })
        .expect(422);
    });

    it('should 404 when user not found', async () => {
      await app
        .httpRequest()
        .patch('/-/team/teamorg/role-team/member/ghost-user')
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(404);
    });

    it('should 404 when user is not a team member', async () => {
      const outsider = await TestUtil.createUser({ name: 'outsider-user' });
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${outsider.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(404);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/nonexistent/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(404);
    });

    it('should allow team owner to update role', async () => {
      // Promote normalUser to owner
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      // normalUser (now team owner) can update others
      const anotherUser = await TestUtil.createUser({ name: 'role-target' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/teamorg/role-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);

      await app
        .httpRequest()
        .patch(`/-/team/teamorg/role-team/member/${anotherUser.name}`)
        .set('authorization', normalUser.authorization)
        .send({ role: 'owner' })
        .expect(200);
    });
  });

  // ==================== addTeamMember ====================
  describe('[PUT /-/team/:orgName/:teamName/user] addTeamMember()', () => {
    beforeEach(async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'add-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);
    });

    it('should add member and verify in list', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/add-team/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(res.body.includes(normalUser.displayName));
    });

    it('should add member as member role by default', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/add-team/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(res.body.some((m: any) => m.user === normalUser.displayName && m.role === 'member'));
    });

    it('should be idempotent when adding same user twice', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/add-team/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      // Should appear only once
      assert.equal(res.body.filter((u: string) => u === normalUser.displayName).length, 1);
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().put('/-/team/teamorg/add-team/user').send({ user: normalUser.name }).expect(401);
    });

    it('should 403 when non-owner tries to add member', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'add-attacker' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(403);
    });

    it('should 422 when user is missing', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when target user not found', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/add-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: 'ghost-user' })
        .expect(404);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/nonexistent/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(404);
    });

    it('should 404 when org not found for write operation', async () => {
      await app
        .httpRequest()
        .put('/-/team/nonexistent-org/some-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(404);
    });
  });

  // ==================== removeTeamMember ====================
  describe('[DELETE /-/team/:orgName/:teamName/user] removeTeamMember()', () => {
    beforeEach(async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'rm-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/rm-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);
    });

    it('should remove team member', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/rm-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/rm-team/user')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(!res.body.includes(normalUser.displayName));
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest().delete('/-/team/teamorg/rm-team/user').send({ user: normalUser.name }).expect(401);
    });

    it('should 403 when non-owner tries to remove member', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/rm-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: normalUser.name })
        .expect(403);
    });

    it('should 422 when user is missing', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/rm-team/user')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when target user not found', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/rm-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: 'ghost-user' })
        .expect(404);
    });

    it('should 404 when team not found', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/nonexistent/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(404);
    });
  });

  // ==================== team package management ====================
  describe('team package management (/-/team/:scope/:team/package)', () => {
    it('should list empty packages initially for team member', async () => {
      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert.deepEqual(res.body, {});
    });

    it('should 403 when non-member lists team packages', async () => {
      await app
        .httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', normalUser.authorization)
        .expect(403);
    });

    it('should 401 list packages without authorization', async () => {
      await app.httpRequest().get('/-/team/teamorg/developers/package').expect(401);
    });

    it('should 404 list packages when team not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/teamorg/nonexistent/package')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });

    it('should 404 list packages when org not found', async () => {
      await app
        .httpRequest()
        .get('/-/team/nonexistent-org/some-team/package')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });

    it('should 422 when package name is missing for grant', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when package not found for grant', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/nonexistent-pkg' })
        .expect(404);
    });

    it('should 422 when package name is missing for revoke', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when package not found for revoke', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/nonexistent-pkg' })
        .expect(404);
    });

    it('should allow org owner but not plain org member to list team packages', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'listpkg-owner-team' })
        .expect(200);
      const orgOwner = await TestUtil.createUser({ name: 'listpkg-org-owner' });
      const orgMember = await TestUtil.createUser({ name: 'listpkg-org-member' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: orgOwner.name, role: 'owner' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: orgMember.name, role: 'member' })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/teamorg/listpkg-owner-team/package')
        .set('authorization', orgOwner.authorization)
        .expect(200);
      assert.deepEqual(res.body, {});
      await app
        .httpRequest()
        .get('/-/team/teamorg/listpkg-owner-team/package')
        .set('authorization', orgMember.authorization)
        .expect(403);
    });

    it('should 403 when non-member lists private team packages on allowScopes org', async () => {
      const victim = await TestUtil.createUser({ name: 'listteam-victim' });
      const attacker = await TestUtil.createUser({ name: 'listteam-attacker' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/listteam-secret', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(pkgPayload)
        .expect(201);
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', victim.authorization)
        .send({ name: 'listteam-vteam' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/listteam-vteam/package')
        .set('authorization', victim.authorization)
        .send({ package: pkgPayload.name })
        .expect(200);

      await app
        .httpRequest()
        .get('/-/team/cnpm/listteam-vteam/package')
        .set('authorization', attacker.authorization)
        .expect(403);

      const ok = await app
        .httpRequest()
        .get('/-/team/cnpm/listteam-vteam/package')
        .set('authorization', victim.authorization)
        .expect(200);
      assert.equal(ok.body[pkgPayload.name], 'read');
    });

    it('should 403 when non-owner tries to grant', async () => {
      await app
        .httpRequest()
        .put('/-/team/teamorg/developers/package')
        .set('authorization', normalUser.authorization)
        .send({ package: '@cnpm/foo' })
        .expect(403);
    });

    it('should 403 when non-owner tries to revoke', async () => {
      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', normalUser.authorization)
        .send({ package: '@cnpm/foo' })
        .expect(403);
    });

    // GHSA-95hv-57mq-2964: grant/revoke must require package maintainer (or admin)
    // and package scope must match the team org. Team ownership alone is not enough.
    it('should 403 when team owner who is not a package maintainer tries to grant', async () => {
      const victim = await TestUtil.createUser({ name: 'ghsa95hv-victim' });
      const attacker = await TestUtil.createUser({ name: 'ghsa95hv-attacker' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/ghsa95hv-secret', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(pkgPayload)
        .expect(201);

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', attacker.authorization)
        .send({ name: 'ghsa95hv-evil' })
        .expect(200);

      const res = await app
        .httpRequest()
        .put('/-/team/cnpm/ghsa95hv-evil/package')
        .set('authorization', attacker.authorization)
        .send({ package: '@cnpm/ghsa95hv-secret' })
        .expect(403);
      assert.match(res.body.error || res.body.message || JSON.stringify(res.body), /not authorized|Forbidden/i);

      // package still has no team binding, so unauthenticated/attacker read must not become private-only
      const readRes = await app
        .httpRequest()
        .get('/@cnpm/ghsa95hv-secret')
        .set('authorization', attacker.authorization)
        .set('Accept', 'application/json');
      assert.notEqual(readRes.status, 403);
    });

    it('should 403 when team owner who is not a package maintainer tries to revoke', async () => {
      const victim = await TestUtil.createUser({ name: 'ghsa95hv-victim-rev' });
      const attacker = await TestUtil.createUser({ name: 'ghsa95hv-attacker-rev' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/ghsa95hv-secret-rev', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(pkgPayload)
        .expect(201);

      // victim binds package to their own team
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', victim.authorization)
        .send({ name: 'ghsa95hv-vteam' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/ghsa95hv-vteam/package')
        .set('authorization', victim.authorization)
        .send({ package: '@cnpm/ghsa95hv-secret-rev' })
        .expect(200);

      // attacker owns a different team and must not revoke (or grant) the victim package
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', attacker.authorization)
        .send({ name: 'ghsa95hv-evil-rev' })
        .expect(200);

      await app
        .httpRequest()
        .delete('/-/team/cnpm/ghsa95hv-evil-rev/package')
        .set('authorization', attacker.authorization)
        .send({ package: '@cnpm/ghsa95hv-secret-rev' })
        .expect(403);

      // attacker still cannot read the now team-bound private package
      await app
        .httpRequest()
        .get('/@cnpm/ghsa95hv-secret-rev')
        .set('authorization', attacker.authorization)
        .set('Accept', 'application/json')
        .expect(403);
    });

    it('should 403 when package scope does not match team org', async () => {
      const publisher = await TestUtil.createUser({ name: 'ghsa95hv-scope-pub' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/ghsa95hv-scope-pkg', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgPayload)
        .expect(201);

      // teamorg is a non-allowScopes org; package is @cnpm/*
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'ghsa95hv-scope-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/ghsa95hv-scope-team/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/ghsa95hv-scope-pkg' })
        .expect(403);
    });

    it('should allow package maintainer who owns the team to grant and revoke', async () => {
      const maintainer = await TestUtil.createUser({ name: 'ghsa95hv-maintainer' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/ghsa95hv-ok', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', maintainer.authorization)
        .set('user-agent', maintainer.ua)
        .send(pkgPayload)
        .expect(201);

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', maintainer.authorization)
        .send({ name: 'ghsa95hv-ok-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/ghsa95hv-ok-team/package')
        .set('authorization', maintainer.authorization)
        .send({ package: '@cnpm/ghsa95hv-ok' })
        .expect(200);

      const listRes = await app
        .httpRequest()
        .get('/-/team/cnpm/ghsa95hv-ok-team/package')
        .set('authorization', maintainer.authorization)
        .expect(200);
      assert.equal(listRes.body['@cnpm/ghsa95hv-ok'], 'read');

      await app
        .httpRequest()
        .delete('/-/team/cnpm/ghsa95hv-ok-team/package')
        .set('authorization', maintainer.authorization)
        .send({ package: '@cnpm/ghsa95hv-ok' })
        .expect(200);
    });

    it('should allow admin to grant when scope matches even if not a maintainer', async () => {
      const publisher = await TestUtil.createUser({ name: 'ghsa95hv-admin-pub' });
      const pkgPayload = await TestUtil.getFullPackage({ name: '@cnpm/ghsa95hv-admin-pkg', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgPayload)
        .expect(201);

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'ghsa95hv-admin-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/ghsa95hv-admin-team/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/ghsa95hv-admin-pkg' })
        .expect(200);
    });

    // Legacy cross-scope bindings (created before the grant scope check) must still
    // be revocable by admin/maintainer; grant of new cross-scope bindings stays forbidden.
    async function createLegacyCrossScopeBinding(packageName: string, publisher: any) {
      const pkgPayload = await TestUtil.getFullPackage({ name: packageName, version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkgPayload.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkgPayload)
        .expect(201);

      const orgRepository = await app.getEggObject(OrgRepository);
      const teamRepository = await app.getEggObject(TeamRepository);
      const packageRepository = await app.getEggObject(PackageRepository);
      const org = await orgRepository.findOrgByName('teamorg');
      assert(org);
      const team = await teamRepository.findTeam(org.orgId, DEVELOPERS_TEAM);
      assert(team);
      const pkg = await packageRepository.findPackage('@cnpm', packageName.split('/')[1]);
      assert(pkg);
      // Simulate legacy data: bind @cnpm/* package to non-@cnpm org team directly.
      await teamRepository.addPackage(
        TeamPackage.create({
          teamId: team.teamId,
          packageId: pkg.packageId,
        }),
      );
      return { team, pkg };
    }

    it('should allow admin to revoke an existing cross-scope binding', async () => {
      const publisher = await TestUtil.createUser({ name: 'ghsa95hv-legacy-admin-pub' });
      await createLegacyCrossScopeBinding('@cnpm/ghsa95hv-legacy-admin', publisher);

      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/ghsa95hv-legacy-admin' })
        .expect(200);

      const listRes = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert.equal(listRes.body['@cnpm/ghsa95hv-legacy-admin'], undefined);
    });

    it('should allow package maintainer to revoke an existing cross-scope binding', async () => {
      const maintainer = await TestUtil.createUser({ name: 'ghsa95hv-legacy-maint' });
      await createLegacyCrossScopeBinding('@cnpm/ghsa95hv-legacy-maint', maintainer);

      // Give maintainer team-owner write access on the legacy team.
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: maintainer.name, role: 'member' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/teamorg/developers/user')
        .set('authorization', adminUser.authorization)
        .send({ user: maintainer.name })
        .expect(200);
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/developers/member/${maintainer.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', maintainer.authorization)
        .send({ package: '@cnpm/ghsa95hv-legacy-maint' })
        .expect(200);

      // binding removed
      const listRes = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert.equal(listRes.body['@cnpm/ghsa95hv-legacy-maint'], undefined);
    });

    it('should 403 when non-maintainer tries to revoke an existing cross-scope binding', async () => {
      const publisher = await TestUtil.createUser({ name: 'ghsa95hv-legacy-pub' });
      const outsider = await TestUtil.createUser({ name: 'ghsa95hv-legacy-outsider' });
      await createLegacyCrossScopeBinding('@cnpm/ghsa95hv-legacy-deny', publisher);

      // outsider owns the team but does not maintain the package
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: outsider.name, role: 'member' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/teamorg/developers/user')
        .set('authorization', adminUser.authorization)
        .send({ user: outsider.name })
        .expect(200);
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/developers/member/${outsider.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      await app
        .httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', outsider.authorization)
        .send({ package: '@cnpm/ghsa95hv-legacy-deny' })
        .expect(403);

      // binding still present
      const listRes = await app
        .httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert.equal(listRes.body['@cnpm/ghsa95hv-legacy-deny'], 'read');
    });
  });

  // ==================== requireTeamWriteAccess permission paths ====================
  describe('requireTeamWriteAccess permission paths', () => {
    beforeEach(async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'perm-team' })
        .expect(200);
    });

    it('should allow admin to write', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'perm-user-1' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/perm-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);
    });

    it('should allow org owner (non-admin) to write', async () => {
      const orgOwner = await TestUtil.createUser({ name: 'perm-org-owner' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: orgOwner.name, role: 'owner' })
        .expect(200);

      const targetUser = await TestUtil.createUser({ name: 'perm-target-1' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: targetUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/perm-team/user')
        .set('authorization', orgOwner.authorization)
        .send({ user: targetUser.name })
        .expect(200);
    });

    it('should allow team owner to write', async () => {
      // Add normalUser to org and team, promote to team owner
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/teamorg/perm-team/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);
      await app
        .httpRequest()
        .patch(`/-/team/teamorg/perm-team/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      const targetUser = await TestUtil.createUser({ name: 'perm-target-2' });
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: targetUser.name, role: 'member' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/teamorg/perm-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: targetUser.name })
        .expect(200);
    });

    it('should reject org member (non-owner, non-team-owner)', async () => {
      await app
        .httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      const targetUser = await TestUtil.createUser({ name: 'perm-target-3' });
      await app
        .httpRequest()
        .put('/-/team/teamorg/perm-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: targetUser.name })
        .expect(403);
    });
  });

  // ==================== allowScopes org ====================
  describe('allowScopes org: team management', () => {
    it('should auto-create org and let normal user create team', async () => {
      const res = await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'my-team', description: 'created by normal user' })
        .expect(200);
      assert(res.body.ok);

      const orgRepository = await app.getEggObject(OrgRepository);
      const org = await orgRepository.findOrgByName('cnpm');
      assert(org);
    });

    it('should let team owner add member', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'team-member-user' });

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'dev-team' })
        .expect(200);

      const res = await app
        .httpRequest()
        .put('/-/team/cnpm/dev-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when non-owner tries to modify team', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'non-owner-user' });

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'restricted-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/restricted-team/user')
        .set('authorization', anotherUser.authorization)
        .send({ user: normalUser.name })
        .expect(403);
    });

    it('should let normal user list teams', async () => {
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'list-test-team' })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes('cnpm:list-test-team'));
    });

    it('should let team owner update member role in allowScopes org', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'allow-role-user' });

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'allow-role-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/allow-role-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);

      await app
        .httpRequest()
        .patch(`/-/team/cnpm/allow-role-team/member/${anotherUser.name}`)
        .set('authorization', normalUser.authorization)
        .send({ role: 'owner' })
        .expect(200);

      const members = await app
        .httpRequest()
        .get('/-/team/cnpm/allow-role-team/member')
        .set('authorization', anotherUser.authorization)
        .expect(200);
      assert(members.body.some((m: any) => m.user === anotherUser.displayName && m.role === 'owner'));
    });

    it('should let team owner remove member in allowScopes org', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'allow-rm-user' });

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'allow-rm-team' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/allow-rm-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);

      await app
        .httpRequest()
        .delete('/-/team/cnpm/allow-rm-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);

      const res = await app
        .httpRequest()
        .get('/-/team/cnpm/allow-rm-team/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(!res.body.includes(anotherUser.displayName));
    });

    it('should 403 non-owner remove member in allowScopes org', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'allow-rm-attacker' });

      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'allow-rm-prot' })
        .expect(200);

      await app
        .httpRequest()
        .put('/-/team/cnpm/allow-rm-prot/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);

      await app
        .httpRequest()
        .delete('/-/team/cnpm/allow-rm-prot/user')
        .set('authorization', anotherUser.authorization)
        .send({ user: normalUser.name })
        .expect(403);
    });
  });
});
