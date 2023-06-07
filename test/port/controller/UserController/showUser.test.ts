import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/UserController/showUser.test.ts', () => {
  describe('[GET /-/user/org.couchdb.user::username] showUser()', () => {
    it('should 200 when user authorized', async () => {
      const { authorization, name, email } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}`)
        .set('authorization', authorization)
        .expect(200);
      assert.deepEqual(res.body, {
        _id: `org.couchdb.user:${name}`,
        name,
        email,
      });
    });

    it('should 404 when user not exists', async () => {
      const { authorization, name } = await TestUtil.createUser();
      let res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}-not-exists`)
        .set('authorization', authorization)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] User "${name}-not-exists" not found`);

      res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}-not-exists`)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] User "${name}-not-exists" not found`);
    });

    it('should 200 dont contains email when user unauthorized', async () => {
      const { name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}`)
        .expect(200);
      assert.deepEqual(res.body, {
        _id: `org.couchdb.user:${name}`,
        name,
      });
    });
  });
});
