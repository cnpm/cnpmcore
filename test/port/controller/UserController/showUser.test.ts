import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/UserController/showUser.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

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

    it('should 200 {ok: false} when user unauthorized', async () => {
      const { name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get(`/-/user/org.couchdb.user:${name}`)
        .expect(200);
      assert.deepEqual(res.body, { ok: false });
    });
  });
});
