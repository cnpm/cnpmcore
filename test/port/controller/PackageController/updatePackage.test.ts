import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/PackageController/updatePackage.test.ts', () => {
  let ctx: Context;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[PUT /:fullname/-rev/:rev] updatePackage', () => {
    const scopedName = '@cnpm/testmodule-update-package';
    let rev = '';

    beforeEach(async () => {
      const pkg = await TestUtil.getFullPackage({ name: scopedName });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      rev = res.body.rev;
    });

    it('should 422 when maintainters empty', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [],
        })
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] maintainers: must NOT have fewer than 1 items');
    });

    it('should 422 when some maintainters not exists', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            {
              name: 'foo',
              email: 'foo@bar.com',
            },
          ],
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Maintainer "foo" not exists');
    });

    it('should 403 request user is not maintainer', async () => {
      const user = await TestUtil.createUser();
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${user.name}" not authorized to modify ${scopedName}, please contact maintainers: "${publisher.name}"`);
    });

    it('should 200 and get latest maintainers', async () => {
      let res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 1);

      const user = await TestUtil.createUser();
      const user2 = await TestUtil.createUser();
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 3);

      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 2);

      // publisher is remove from maintainers
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] \"${publisher.name}\" not authorized to modify ${scopedName}, please contact maintainers: \"${user.name}, ${user2.name}\"`);
    });
  });
});
