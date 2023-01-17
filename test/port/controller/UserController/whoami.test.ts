import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/UserController/whoami.test.ts', () => {
  describe('[GET /-/whoami] whoami()', () => {
    it('should 200', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', authorization)
        .expect(200);
      assert.equal(res.body.username, name);
    });

    it('should unauthorized', async () => {
      let res = await app.httpRequest()
        .get('/-/whoami')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');

      res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', 'Bearer foo-token')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Invalid token');
    });
  });
});
