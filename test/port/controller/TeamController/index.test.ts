import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';
import { OrgRepository } from '../../../../app/repository/OrgRepository';

describe('test/port/controller/TeamController/index.test.ts', () => {
  let adminUser: any;
  let normalUser: any;

  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    normalUser = await TestUtil.createUser({ name: 'team-ctrl-user' });

    // Create org for team tests (non-allowScopes org, requires admin)
    await app.httpRequest()
      .put('/-/org')
      .set('authorization', adminUser.authorization)
      .send({ name: 'teamorg' })
      .expect(200);
  });

  describe('[PUT /-/org/:orgName/team] createTeam()', () => {
    it('should 200 when admin creates team', async () => {
      const res = await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'frontend', description: 'Frontend team' })
        .expect(200);
      assert(res.body.ok);
    });

    it('should auto-add creator as team owner', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'owned-team' })
        .expect(200);

      // Verify via private API
      const res = await app.httpRequest()
        .get('/-/team/teamorg/owned-team/member')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((m: any) => m.user === adminUser.displayName && m.role === 'owner'));
    });

    it('should 403 when non-owner creates team', async () => {
      // Add normalUser as member (not owner)
      await app.httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'backend' })
        .expect(403);
    });

    it('should 422 when name is missing', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 403 when team name already exists', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'dup-team' })
        .expect(200);
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'dup-team' })
        .expect(403);
    });
  });

  describe('[GET /-/org/:orgName/team] listTeams()', () => {
    it('should list teams including developers', async () => {
      const res = await app.httpRequest()
        .get('/-/org/teamorg/team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes('teamorg:developers'));
    });
  });

  // npm compatible routes: /-/team/:scope/:team
  describe('[GET /-/team/:orgName/:teamName] showTeam()', () => {
    it('should 200', async () => {
      const res = await app.httpRequest()
        .get('/-/team/teamorg/developers')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body.name, 'developers');
    });

    it('should 404 when team not found', async () => {
      await app.httpRequest()
        .get('/-/team/teamorg/nonexistent')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  describe('[DELETE /-/team/:orgName/:teamName] removeTeam()', () => {
    it('should 200 for custom team', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'to-delete' })
        .expect(200);

      const res = await app.httpRequest()
        .delete('/-/team/teamorg/to-delete')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when deleting developers team', async () => {
      await app.httpRequest()
        .delete('/-/team/teamorg/developers')
        .set('authorization', adminUser.authorization)
        .expect(403);
    });
  });

  describe('team member management (/-/team/:scope/:team/user)', () => {
    beforeEach(async () => {
      // Create a custom team (admin is auto-added as owner)
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'coreteam' })
        .expect(200);

      // Add normalUser to org first
      await app.httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);
    });

    it('should add and list team members (npm compatible, string array)', async () => {
      // Add to team via npm compatible route
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      // npm compatible: returns string array
      const res = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes(adminUser.displayName));
      assert(res.body.includes(normalUser.displayName));
    });

    it('should list team members with role via private API', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      // Private API: returns [{user, role}]
      const res = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((m: any) => m.user === adminUser.displayName && m.role === 'owner'));
      assert(res.body.some((m: any) => m.user === normalUser.displayName && m.role === 'member'));
    });

    it('should add team member with owner role', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'owner' })
        .expect(200);

      const res = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(res.body.some((m: any) => m.user === normalUser.displayName && m.role === 'owner'));
    });

    it('should update team member role via private API', async () => {
      // Add normalUser as member
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      // Promote to owner
      const res = await app.httpRequest()
        .patch(`/-/team/teamorg/coreteam/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(200);
      assert(res.body.ok);

      // Verify role changed
      const members = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(members.body.some((m: any) => m.user === normalUser.displayName && m.role === 'owner'));
    });

    it('should demote team member from owner to member', async () => {
      // Add as owner
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'owner' })
        .expect(200);

      // Demote to member
      await app.httpRequest()
        .patch(`/-/team/teamorg/coreteam/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'member' })
        .expect(200);

      const members = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(members.body.some((m: any) => m.user === normalUser.displayName && m.role === 'member'));
    });

    it('should 422 when role is invalid for update', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      await app.httpRequest()
        .patch(`/-/team/teamorg/coreteam/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'admin' })
        .expect(422);
    });

    it('should 404 when updating role of non-member', async () => {
      await app.httpRequest()
        .patch(`/-/team/teamorg/coreteam/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .send({ role: 'owner' })
        .expect(404);
    });

    it('should 403 when non-owner tries to update role', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      await app.httpRequest()
        .patch(`/-/team/teamorg/coreteam/member/${normalUser.name}`)
        .set('authorization', normalUser.authorization)
        .send({ role: 'owner' })
        .expect(403);
    });

    it('should 403 when non-owner tries to add member', async () => {
      // normalUser is org member but not team owner
      const anotherUser = await TestUtil.createUser({ name: 'another-user' });
      await app.httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(200);

      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(403);
    });

    it('should allow team owner to manage members', async () => {
      // Make normalUser a team owner
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'owner' })
        .expect(200);

      // Now normalUser (team owner) can add another member
      const anotherUser = await TestUtil.createUser({ name: 'managed-user' });
      await app.httpRequest()
        .put('/-/org/teamorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(200);

      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);
    });

    it('should remove team member via body', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      // npm rm sends DELETE with body {user}
      await app.httpRequest()
        .delete('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      const res = await app.httpRequest()
        .get('/-/team/teamorg/coreteam/user')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(!res.body.includes(normalUser.displayName));
    });

    it('should 422 when user is missing', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when target user not found', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/coreteam/user')
        .set('authorization', adminUser.authorization)
        .send({ user: 'ghost-user' })
        .expect(404);
    });
  });

  describe('team package management (/-/team/:scope/:team/package)', () => {
    it('should list empty packages initially', async () => {
      const res = await app.httpRequest()
        .get('/-/team/teamorg/developers/package')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.deepEqual(res.body, {});
    });

    it('should 422 when package name is missing for grant', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when package not found for grant', async () => {
      await app.httpRequest()
        .put('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/nonexistent-pkg' })
        .expect(404);
    });

    it('should 404 when package not found for revoke', async () => {
      await app.httpRequest()
        .delete('/-/team/teamorg/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/nonexistent-pkg' })
        .expect(404);
    });
  });

  // @cnpm is in allowScopes — any authenticated user can manage teams
  describe('allowScopes org: authenticated user can manage teams', () => {
    it('should auto-create org and let normal user create team', async () => {
      const res = await app.httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'my-team', description: 'created by normal user' })
        .expect(200);
      assert(res.body.ok);

      // Verify org was auto-created
      const orgRepository = await app.getEggObject(OrgRepository);
      const org = await orgRepository.findOrgByName('cnpm');
      assert(org);
    });

    it('should let team owner add member for allowScopes org', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'team-member-user' });

      // Create team (normalUser becomes owner)
      await app.httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'dev-team' })
        .expect(200);

      // Owner can add member
      const res = await app.httpRequest()
        .put('/-/team/cnpm/dev-team/user')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when non-owner tries to modify team in allowScopes org', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'non-owner-user' });

      // normalUser creates team (becomes owner)
      await app.httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'restricted-team' })
        .expect(200);

      // anotherUser is not team owner, should be forbidden
      await app.httpRequest()
        .put('/-/team/cnpm/restricted-team/user')
        .set('authorization', anotherUser.authorization)
        .send({ user: normalUser.name })
        .expect(403);
    });

    it('should let normal user list teams for allowScopes org', async () => {
      await app.httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'list-test-team' })
        .expect(200);

      const res = await app.httpRequest()
        .get('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes('cnpm:list-test-team'));
    });
  });

  describe('[GET /-/user/:username/team?org=] listUserTeams()', () => {
    it('should list teams with role for current user in specified org', async () => {
      // admin creates org and is auto-added to developers team
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'userteamorg' })
        .expect(200);

      // Create a custom team and add admin
      await app.httpRequest()
        .put('/-/org/userteamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'core', description: 'Core team' })
        .expect(200);

      const res = await app.httpRequest()
        .get(`/-/user/${adminUser.name}/team?org=userteamorg`)
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((t: any) => t.name === 'userteamorg:developers' && t.role === 'owner'));
      assert(res.body.some((t: any) => t.name === 'userteamorg:core' && t.description === 'Core team' && t.role === 'owner'));
    });

    it('should 403 when querying other user teams as non-admin', async () => {
      await app.httpRequest()
        .get(`/-/user/${adminUser.name}/team?org=teamorg`)
        .set('authorization', normalUser.authorization)
        .expect(403);
    });

    it('should allow admin to query other user teams', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'adminqueryorg' })
        .expect(200);

      // Add normalUser to org
      await app.httpRequest()
        .put('/-/org/adminqueryorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      const res = await app.httpRequest()
        .get(`/-/user/${normalUser.name}/team?org=adminqueryorg`)
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      // normalUser auto-added to developers team as member
      assert(res.body.some((t: any) => t.name === 'adminqueryorg:developers' && t.role === 'member'));
    });

    it('should 422 when org query param is missing', async () => {
      await app.httpRequest()
        .get(`/-/user/${adminUser.name}/team`)
        .set('authorization', adminUser.authorization)
        .expect(422);
    });

    it('should 404 when org not found', async () => {
      await app.httpRequest()
        .get(`/-/user/${adminUser.name}/team?org=nonexistent`)
        .set('authorization', adminUser.authorization)
        .expect(404);
    });

    it('should 404 when user not found', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'usrnotfoundorg' })
        .expect(200);

      await app.httpRequest()
        .get('/-/user/ghost-user/team?org=usrnotfoundorg')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });

    it('should return empty array when user has no teams', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'emptyteamorg' })
        .expect(200);

      const res = await app.httpRequest()
        .get(`/-/user/${normalUser.name}/team?org=emptyteamorg`)
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert.equal(res.body.length, 0);
    });

    it('should 401 without authorization', async () => {
      await app.httpRequest()
        .get(`/-/user/${adminUser.name}/team?org=teamorg`)
        .expect(401);
    });
  });
});
