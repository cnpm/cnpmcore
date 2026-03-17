import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/OrgController/index.test.ts', () => {
  let adminUser: any;
  let normalUser: any;

  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    normalUser = await TestUtil.createUser({ name: 'org-ctrl-user' });
  });

  describe('[PUT /-/org] createOrg()', () => {
    it('should 200 when admin creates org', async () => {
      const res = await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'testorg', description: 'Test Org' })
        .expect(200);
      assert(res.body.ok);
    });

    it('should 403 when non-admin creates org', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', normalUser.authorization)
        .send({ name: 'testorg2' })
        .expect(403);
    });

    it('should 422 when name is missing', async () => {
      const res = await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
      assert(res.body.error.includes('name is required'));
    });

    it('should 403 when org name already exists', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'duporg' })
        .expect(200);
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'duporg' })
        .expect(403);
    });
  });

  describe('[GET /-/org/:orgName] showOrg()', () => {
    it('should 200', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'showorg', description: 'desc' })
        .expect(200);
      const res = await app.httpRequest()
        .get('/-/org/showorg')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body.name, 'showorg');
      assert.equal(res.body.description, 'desc');
    });

    it('should 404 when org not found', async () => {
      await app.httpRequest()
        .get('/-/org/nonexistent')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  describe('[DELETE /-/org/:orgName] removeOrg()', () => {
    it('should 200 when admin deletes org', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'delorg' })
        .expect(200);
      const res = await app.httpRequest()
        .delete('/-/org/delorg')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(res.body.ok);

      // Verify org is gone
      await app.httpRequest()
        .get('/-/org/delorg')
        .set('authorization', normalUser.authorization)
        .expect(404);
    });
  });

  describe('[GET/PUT/DELETE /-/org/:orgName/member] member management', () => {
    beforeEach(async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'memberorg' })
        .expect(200);
    });

    it('should list members', async () => {
      const res = await app.httpRequest()
        .get('/-/org/memberorg/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      // Admin is the creator/owner
      assert.equal(typeof res.body, 'object');
      assert.equal(res.body[adminUser.displayName], 'owner');
    });

    it('should add and remove member', async () => {
      // Add
      await app.httpRequest()
        .put('/-/org/memberorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      // Verify
      let res = await app.httpRequest()
        .get('/-/org/memberorg/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body[normalUser.displayName], 'member');

      // Remove
      await app.httpRequest()
        .delete(`/-/org/memberorg/member/${normalUser.name}`)
        .set('authorization', adminUser.authorization)
        .expect(200);

      // Verify removed
      res = await app.httpRequest()
        .get('/-/org/memberorg/member')
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert.equal(res.body[normalUser.displayName], undefined);
    });

    it('should 403 when non-owner adds member', async () => {
      // Add normalUser as member first
      await app.httpRequest()
        .put('/-/org/memberorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: normalUser.name, role: 'member' })
        .expect(200);

      const anotherUser = await TestUtil.createUser({ name: 'another-user' });
      // normalUser (member, not owner) tries to add
      await app.httpRequest()
        .put('/-/org/memberorg/member')
        .set('authorization', normalUser.authorization)
        .send({ user: anotherUser.name, role: 'member' })
        .expect(403);
    });

    it('should 422 when user is missing', async () => {
      await app.httpRequest()
        .put('/-/org/memberorg/member')
        .set('authorization', adminUser.authorization)
        .send({})
        .expect(422);
    });

    it('should 404 when target user not found', async () => {
      await app.httpRequest()
        .put('/-/org/memberorg/member')
        .set('authorization', adminUser.authorization)
        .send({ user: 'nonexistent-user' })
        .expect(404);
    });
  });

  describe('[GET /-/org/:orgName/member/:username/team] listUserTeams()', () => {
    it('should list teams for user', async () => {
      await app.httpRequest()
        .put('/-/org')
        .set('authorization', adminUser.authorization)
        .send({ name: 'teamlistorg' })
        .expect(200);

      const res = await app.httpRequest()
        .get(`/-/org/teamlistorg/member/${adminUser.name}/team`)
        .set('authorization', normalUser.authorization)
        .expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.some((t: any) => t.name === 'developers'));
    });
  });
});
