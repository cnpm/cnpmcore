import { TokenType } from '../../../../app/core/entity/Token';
import { UserService } from '../../../../app/core/service/UserService';
import { AuthAdapter } from '../../../../app/infra/AuthAdapter';
import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import dayjs from 'dayjs';

describe('test/port/controller/TokenController/listTokens.test.ts', () => {
  describe('[GET /-/npm/v1/tokens] listTokens()', () => {
    it('should 401', async () => {
      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', 'Bearer foo-token')
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Invalid token');
    });

    it('should 200', async () => {
      const { authorization } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      const tokens = res.body.objects;
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].token.length, 8);
      assert.deepEqual(tokens[0].cidr_whitelist, []);
      assert.equal(tokens[0].readonly, false);
      assert.equal(tokens[0].automation, false);
      assert(tokens[0].created);
      assert(tokens[0].updated);
    });

    it('should update lastUsedAt', async () => {
      const { authorization } = await TestUtil.createUser();
      const now = Date.now();

      let res = await app.httpRequest()
        .get('/-/whoami')
        .set('authorization', authorization)
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);

      const lastUsedAt = res.body.objects[0].lastUsedAt;
      assert(dayjs(lastUsedAt).isAfter(now));
    });

    it('should 401 when readonly token access', async () => {
      const { authorization } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token \"cnpm_\w+\" can\'t setting/);
    });
  });

  describe('[GET /-/npm/v1/tokens/gat] listGranularTokens()', () => {
    beforeEach(async () => {
      await TestUtil.createPackage({ name: '@cnpm/a', isPrivate: true });
      const { name, email } = await TestUtil.createUser();
      const userService = await app.getEggObject(UserService);
      const user = await userService.findUserByName(name);
      assert(user);
      await userService.createToken(user.userId, {
        name: 'good',
        type: TokenType.granular,
        allowedPackages: [ '@cnpm/a' ],
        allowedScopes: [ '@cnpmjs' ],
        expires: 1,
      });

      mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
        return {
          name,
          email,
        };
      });
    });

    it('should 200', async () => {
      const res = await app.httpRequest()
        .get('/-/npm/v1/tokens/gat')
        .expect(200);

      assert.equal(res.body.objects.length, 1);
      assert.equal(res.body.objects[0].name, 'good');
      assert.deepEqual(res.body.objects[0].allowedScopes, [ '@cnpmjs' ]);
      assert.deepEqual(res.body.objects[0].allowedPackages, [ '@cnpm/a' ]);
    });
  });
});
