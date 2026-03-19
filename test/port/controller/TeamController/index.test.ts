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
      assert(res.body.some((t: any) => t.name === 'developers'));
    });
  });

  describe('[GET /-/org/:orgName/team/:teamName] showTeam()', () => {
    it('should 200', async () => {
      const res = await app.httpRequest()
        .get('/-/org/teamorg/team/developers')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body.name, 'developers');
    });

    it('should 404 when team not found', async () => {
      await app.httpRequest()
        .get('/-/org/teamorg/team/nonexistent')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  describe('[DELETE /-/org/:orgName/team/:teamName] removeTeam()', () => {
    it('should 200 for custom team', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team')
        .set('authorization', adminUser.authorization)
        .send({ name: 'to-delete' })
        .expect(200);

      const res = await app.httpRequest()
        .delete('/-/org/teamorg/team/to-delete')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when deleting developers team', async () => {
      await app.httpRequest()
        .delete('/-/org/teamorg/team/developers')
        .set('authorization', adminUser.authorization)
        .expect(403);
    });
  });

  describe('team member management', () => {
    beforeEach(async () => {
      // Create a custom team
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

    it('should add and list team members', async () => {
      // Add to team
      await app.httpRequest()
        .put('/-/org/teamorg/team/coreteam/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      // List members
      const res = await app.httpRequest()
        .get('/-/org/teamorg/team/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.includes(normalUser.displayName));
    });

    it('should remove team member', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team/coreteam/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name })
        .expect(200);

      await app.httpRequest()
        .delete(`/-/org/teamorg/team/coreteam/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .expect(200);

      const res = await app.httpRequest()
        .get('/-/org/teamorg/team/coreteam/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(!res.body.includes(normalUser.displayName));
    });

    it('should 422 when user is missing', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team/coreteam/member')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when target user not found', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team/coreteam/member')
        .set('authorization', adminUser.authorization)
        .send({ user: 'ghost-user' })
        .expect(404);
    });
  });

  describe('team package management', () => {
    it('should list empty packages initially', async () => {
      const res = await app.httpRequest()
        .get('/-/org/teamorg/team/developers/package')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.deepEqual(res.body, {});
    });

    it('should 422 when package name is missing for grant', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team/developers/package')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when package not found for grant', async () => {
      await app.httpRequest()
        .put('/-/org/teamorg/team/developers/package')
        .set('authorization', adminUser.authorization)
        .send({ package: '@cnpm/nonexistent-pkg' })
        .expect(404);
    });

    it('should 404 when package not found for revoke', async () => {
      await app.httpRequest()
        .delete('/-/org/teamorg/team/developers/package/@cnpm/nonexistent-pkg')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });
  });

  // @cnpm is in allowScopes — self-registry users can manage teams directly
  describe('allowScopes org: self-registry user can manage teams', () => {
    it('should auto-create org and let normal user create team', async () => {
      // normalUser is self-registry (isPrivate=true), @cnpm is in allowScopes
      // No need to manually create org first
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

    it('should let normal user add team member without org membership', async () => {
      const anotherUser = await TestUtil.createUser({ name: 'team-member-user' });

      // Create team
      await app.httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', normalUser.authorization)
        .send({ name: 'dev-team' })
        .expect(200);

      // Add member — no org membership required for allowScopes org
      const res = await app.httpRequest()
        .put('/-/org/cnpm/team/dev-team/member')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name })
        .expect(200);
      assert(res.body.ok);
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
      assert(res.body.some((t: any) => t.name === 'list-test-team'));
    });
  });
});
