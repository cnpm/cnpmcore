import { AuthAdapter } from '../../../../app/infra/AuthAdapter';
import assert from 'assert';
import dayjs from 'dayjs';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/UserController/whoami.test.ts', () => {
  describe('[GET /-/whoami] whoami()', () => {
    it('should 200', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', authorization)
        .expect(200);
      assert.deepStrictEqual(res.body, { username: name });
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

    it('should return granular token info', async () => {
      const { name, email } = await TestUtil.createUser({ name: 'banana' });
      await TestUtil.createPackage({ name: '@cnpm/banana' });
      mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
        return {
          name,
          email,
        };
      });
      let res = await app.httpRequest()
        .post('/-/npm/v1/tokens/gat')
        .send({
          name: 'apple',
          description: 'lets play',
          allowedPackages: [ '@cnpm/banana' ],
          allowedScopes: [ '@banana' ],
          expires: 30,
        })
        .expect(200);

      res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', `Bearer ${res.body.token}`)
        .expect(200);

      assert.equal(res.body.username, name);
      assert.equal(res.body.name, 'apple');
      assert.equal(res.body.description, 'lets play');
      assert.deepEqual(res.body.allowedPackages, [ '@cnpm/banana' ]);
      assert.deepEqual(res.body.allowedScopes, [ '@banana' ]);
      assert(dayjs(res.body.expires).isBefore(dayjs().add(30, 'days')));
    });
  });
});
