import { Token, TokenType } from '../../../../app/core/entity/Token';
import { UserService } from '../../../../app/core/service/UserService';
import { AuthAdapter } from '../../../../app/infra/AuthAdapter';
import { TokenPackage } from '../../../../app/repository/model/TokenPackage';
import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/TokenController/removeToken.test.ts', () => {
  describe('[DELETE /-/npm/v1/tokens/token/:tokenKey] removeToken()', () => {
    it('should 200', async () => {
      const { authorization, password, token, ua } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
        })
        .expect(200);

      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(200);
      let tokens = res.body.objects;
      assert.equal(tokens.length, 2);

      await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${tokens[1].key}`)
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 1);

      // remove token itself
      await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${token}`)
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(401);
      assert.equal(res.body.error, '[UNAUTHORIZED] Invalid token');
    });

    it('should 403 when readonly token access', async () => {
      const { authorization, token, ua } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${token}`)
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token \"cnpm_\w+\" can\'t setting/);
    });

    it('should 403 when automation token access', async () => {
      const { authorization, token, ua } = await TestUtil.createUser({ tokenOptions: { automation: true } });
      const res = await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${token}`)
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Automation Token \"cnpm_\w+\" can\'t setting/);
    });

    it('should 404 when token key not exists', async () => {
      const { authorization, password, ua } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
        })
        .expect(200);

      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      const tokens = res.body.objects;
      assert.equal(tokens.length, 2);

      res = await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${tokens[1].key}-not-exists`)
        .set('authorization', authorization)
        .set('user-agent', ua)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] Token "${tokens[1].key}-not-exists" not exists`);
    });

    it('should 401 when remove other user token', async () => {
      const { authorization, password, ua } = await TestUtil.createUser();
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
        })
        .expect(200);

      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      const tokens = res.body.objects;
      assert.equal(tokens.length, 2);

      const otherUser = await TestUtil.createUser();

      res = await app.httpRequest()
        .delete(`/-/npm/v1/tokens/token/${tokens[1].key}`)
        .set('authorization', otherUser.authorization)
        .set('user-agent', ua)
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] Not authorized to remove token "${tokens[1].key}"`);
    });
  });

  describe('[DELETE /-/npm/v1/tokens/gat/:tokenKey] removeGranularToken()', () => {
    let token: Token;
    beforeEach(async () => {
      const { name, email } = await TestUtil.createUser();
      const userService = await app.getEggObject(UserService);
      const user = await userService.findUserByName(name);
      assert(user);
      await TestUtil.createPackage({ name: '@cnpm/foo' }, { name: user.name });
      token = await userService.createToken(user.userId, {
        name: 'good',
        type: TokenType.granular,
        allowedPackages: [ '@cnpm/foo' ],
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
      let res = await app.httpRequest()
        .get('/-/npm/v1/tokens/gat')
        .expect(200);

      assert.equal(res.body.objects.length, 1);
      let pkgsCount = await TokenPackage.find({ tokenId: token.tokenId }).count();
      assert.equal(pkgsCount, 1);

      await app.httpRequest()
        .delete(`/-/npm/v1/tokens/gat/${token.tokenKey}`)
        .expect(204);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens/gat')
        .expect(200);

      assert.equal(res.body.objects.length, 0);

      pkgsCount = await TokenPackage.find({ tokenId: token.tokenId }).count();
      assert.equal(pkgsCount, 0);
    });

  });
});
