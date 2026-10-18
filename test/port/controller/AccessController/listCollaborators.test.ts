import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/port/controller/AccessController/listCollaborators.test.ts', () => {
  describe('[GET /-/package/:fullname/collaborators] listCollaborators()', () => {
    it('should work', async () => {
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0' }, { name: 'banana-owner' });
      const res = await app.httpRequest().get(`/-/package/${pkg.name}/collaborators`).expect(200);

      assert.ok(res.body['banana-owner'] === 'write');
    });

    it('should 403 when pkg not exists', async () => {
      const res = await app.httpRequest().get('/-/package/banana/collaborators').expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Forbidden');
    });

    it('should refresh when maintainer updated', async () => {
      const owner = await TestUtil.createUser({ name: 'banana-owner' });
      const maintainer = await TestUtil.createUser({
        name: 'banana-maintainer',
      });

      // create pkg
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/banana' });
      const createRes = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', owner.authorization)
        .set('user-agent', owner.ua)
        .send(pkg)
        .expect(201);
      assert.equal(createRes.body.ok, true);
      assert.match(createRes.body.rev, /^\d+-\w{24}$/);
      const rev = createRes.body.rev;

      // updateMaintainers
      await app
        .httpRequest()
        .put(`/${pkg.name}/-rev/${rev}`)
        .set('authorization', owner.authorization)
        .set('user-agent', owner.ua)
        .set('npm-command', 'owner')
        .send({
          ...pkg,
          maintainers: [
            { name: maintainer.name, email: maintainer.email },
            { name: owner.name, email: owner.email },
          ],
        })
        .expect(200);

      const res = await app.httpRequest().get(`/-/package/${pkg.name}/collaborators`).expect(200);

      assert.ok(res.body['banana-owner'] === 'write');
      assert.ok(res.body['banana-maintainer'] === 'write');
    });

    it('should 403 collaborators for team-private package without access', async () => {
      const victim = await TestUtil.createUser({ name: 'collab-victim-priv' });
      const attacker = await TestUtil.createUser({ name: 'collab-attacker-priv' });
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/collab-private', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(pkg)
        .expect(201);
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', victim.authorization)
        .send({ name: 'collab-vteam' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/collab-vteam/package')
        .set('authorization', victim.authorization)
        .send({ package: pkg.name })
        .expect(200);

      await app.httpRequest().get(`/-/package/${pkg.name}/collaborators`).expect(401);
      await app
        .httpRequest()
        .get(`/-/package/${pkg.name}/collaborators`)
        .set('authorization', attacker.authorization)
        .expect(403);
      const ok = await app
        .httpRequest()
        .get(`/-/package/${pkg.name}/collaborators`)
        .set('authorization', victim.authorization)
        .expect(200);
      assert.equal(ok.body[victim.displayName], 'write');
    });
  });
});
