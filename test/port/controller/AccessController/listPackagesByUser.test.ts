import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/port/controller/AccessController/listPackagesByUser.test.ts', () => {
  describe('[GET /-/org/:username/package] listPackagesByUser()', () => {
    it('should work', async () => {
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0' }, { name: 'banana' });
      const res = await app.httpRequest().get('/-/org/banana/package').expect(200);

      assert.equal(res.body[pkg.name], 'write');
    });

    it('should 404 when user not exists', async () => {
      const res = await app.httpRequest().get('/-/org/banana-disappear/package').expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] User "banana-disappear" not found');
    });

    it('should omit team-private packages the caller cannot read', async () => {
      const victim = await TestUtil.createUser({ name: 'listpkg-victim-priv' });
      const attacker = await TestUtil.createUser({ name: 'listpkg-attacker-priv' });
      const publicPkg = await TestUtil.getFullPackage({ name: '@cnpm/listpkg-public', version: '1.0.0' });
      const privatePkg = await TestUtil.getFullPackage({ name: '@cnpm/listpkg-private', version: '1.0.0' });
      for (const pkg of [publicPkg, privatePkg]) {
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', victim.authorization)
          .set('user-agent', victim.ua)
          .send(pkg)
          .expect(201);
      }
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', victim.authorization)
        .send({ name: 'listpkg-vteam' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/listpkg-vteam/package')
        .set('authorization', victim.authorization)
        .send({ package: privatePkg.name })
        .expect(200);

      const anon = await app.httpRequest().get(`/-/org/${victim.name}/package`).expect(200);
      assert.equal(anon.body[publicPkg.name], 'write');
      assert.equal(anon.body[privatePkg.name], undefined);

      const asAttacker = await app
        .httpRequest()
        .get(`/-/org/${victim.name}/package`)
        .set('authorization', attacker.authorization)
        .expect(200);
      assert.equal(asAttacker.body[publicPkg.name], 'write');
      assert.equal(asAttacker.body[privatePkg.name], undefined);

      const asVictim = await app
        .httpRequest()
        .get(`/-/org/${victim.name}/package`)
        .set('authorization', victim.authorization)
        .expect(200);
      assert.equal(asVictim.body[publicPkg.name], 'write');
      assert.equal(asVictim.body[privatePkg.name], 'write');
    });
  });
});
