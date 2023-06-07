import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/AccessController/listCollaborators.test.ts', () => {
  describe('[GET /-/package/:fullname/collaborators] listCollaborators()', () => {

    it('should work', async () => {
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0' }, { name: 'banana-owner' });
      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/collaborators`)
        .expect(200);

      assert(res.body['banana-owner'] === 'write');
    });

    it('should 403 when pkg not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/package/banana/collaborators')
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Forbidden');
    });

    it('should refresh when maintainer updated', async () => {
      const owner = await TestUtil.createUser({ name: 'banana-owner' });
      const maintainer = await TestUtil.createUser({ name: 'banana-maintainer' });


      // create pkg
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/banana' });
      const createRes = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', owner.authorization)
        .set('user-agent', owner.ua)
        .send(pkg)
        .expect(201);
      assert.equal(createRes.body.ok, true);
      assert.match(createRes.body.rev, /^\d+\-\w{24}$/);
      const rev = createRes.body.rev;

      // updateMaintainers
      await app.httpRequest()
        .put(`/${pkg.name}/-rev/${rev}`)
        .set('authorization', owner.authorization)
        .set('user-agent', owner.ua)
        .set('npm-command', 'owner')
        .send({
          ...pkg,
          maintainers: [{ name: maintainer.name, email: maintainer.email }, { name: owner.name, email: owner.email }],
        })
        .expect(200);

      const res = await app.httpRequest()
        .get(`/-/package/${pkg.name}/collaborators`)
        .expect(200);

      assert(res.body['banana-owner'] === 'write');
      assert(res.body['banana-maintainer'] === 'write');
    });

  });
});
