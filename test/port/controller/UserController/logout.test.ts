import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/UserController/logout.test.ts', () => {
  describe('[DELETE /-/user/token/:token] logout()', () => {
    it('should {ok: false} when not login', async () => {
      const res = await app.httpRequest()
        .delete('/-/user/token/some-token')
        .expect(200);
      assert.equal(res.body.ok, false);
    });

    it('should {ok: true} when logout success', async () => {
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .delete(`/-/user/token/${user.token}`)
        .set('authorization', user.authorization)
        .expect(200);
      assert.equal(res.body.ok, true);
      // again will false
      res = await app.httpRequest()
        .delete(`/-/user/token/${user.token}`)
        .set('authorization', user.authorization)
        .expect(200);
      assert.equal(res.body.ok, false);
    });

    it('should 400 when token invalid', async () => {
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .delete('/-/user/token/invalid-token-value')
        .set('authorization', user.authorization + 'foo')
        .expect(200);
      assert.equal(res.body.ok, false);
      res = await app.httpRequest()
        .delete('/-/user/token/invalid-token-value')
        .set('authorization', user.authorization)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] invalid token');
    });

    it('should 422 when logout by other token', async () => {
      const user = await TestUtil.createUser();
      const other = await TestUtil.createUser();
      const res = await app.httpRequest()
        .delete(`/-/user/token/${user.token}`)
        .set('authorization', other.authorization)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] invalid token');
    });
  });
});
