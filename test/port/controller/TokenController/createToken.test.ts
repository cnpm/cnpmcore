import { Token, TokenType } from '../../../../app/core/entity/Token';
import { AuthAdapter } from '../../../../app/infra/AuthAdapter';
import { UserRepository } from '../../../../app/repository/UserRepository';
import assert from 'assert';
import dayjs from 'dayjs';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/TokenController/createToken.test.ts', () => {
  describe('[POST /-/npm/v1/tokens] createToken()', () => {
    it('should 200', async () => {
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
      let tokens = res.body.objects;
      assert.equal(tokens.length, 2);
      assert.equal(tokens[1].readonly, false);
      assert.equal(tokens[1].automation, false);
      assert.deepEqual(tokens[1].cidr_whitelist, []);

      // readonly
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
          readonly: true,
        })
        .expect(200);
      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 3);
      assert.equal(tokens[2].readonly, true);
      assert.equal(tokens[2].automation, false);
      assert.deepEqual(tokens[2].cidr_whitelist, []);

      // automation
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
          automation: true,
        })
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 4);
      assert.equal(tokens[3].readonly, false);
      assert.equal(tokens[3].automation, true);
      assert.deepEqual(tokens[3].cidr_whitelist, []);

      // cidr_whitelist
      await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({
          password,
          automation: true,
          cidr_whitelist: [ '192.168.1.1/24' ],
        })
        .expect(200);

      res = await app.httpRequest()
        .get('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .expect(200);
      tokens = res.body.objects;
      assert.equal(tokens.length, 5);
      assert.equal(tokens[4].readonly, false);
      assert.equal(tokens[4].automation, true);
      assert.deepEqual(tokens[4].cidr_whitelist, [ '192.168.1.1/24' ]);
    });

    it('should 401 when readonly token access', async () => {
      const { authorization, password, ua } = await TestUtil.createUser({ tokenOptions: { readonly: true } });
      const res = await app.httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', authorization)
        .set('user-agent', ua)
        .send({ password })
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] Read-only Token \"cnpm_\w+\" can\'t setting/);
    });
  });

  describe('[POST /-/npm/v1/tokens/gat] createGranularToken()', () => {
    it('should 422 when invalid options', async () => {
      let res = await app.httpRequest()
        .post('/-/npm/v1/tokens/gat')
        .send({
          name: 'banana',
        })
        .expect(422);
      assert.match(res.body.error, /\[INVALID_PARAM\] must have required property 'expires'/);

      res = await app.httpRequest()
        .post('/-/npm/v1/tokens/gat')
        .send({
          name: 'banana',
          expires: 366,
        })
        .expect(422);
      assert.match(res.body.error, /\[INVALID_PARAM\] expires: must be <= 365/);
    });

    it('should 403 when no login', async () => {
      const res = await app.httpRequest()
        .post('/-/npm/v1/tokens/gat')
        .send({
          name: 'banana',
          expires: 30,
        })
        .expect(403);
      assert.match(res.body.error, /\[FORBIDDEN\] need login first/);
    });

    it('should auto create when no user info', async () => {
      mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
        return {
          name: 'banana',
          email: 'banana@fruits.com',
        };
      });
      await app.httpRequest()
        .post('/-/npm/v1/tokens/gat')
        .send({
          name: 'banana',
          expires: 30,
        })
        .expect(200);
    });

    describe('should 200', () => {
      beforeEach(async () => {
        const { name, email } = await TestUtil.createUser({ name: 'banana' });
        mock(AuthAdapter.prototype, 'ensureCurrentUser', async () => {
          return {
            name,
            email,
          };
        });
      });

      it('should work', async () => {
        const start = Date.now();
        await TestUtil.createPackage({ name: '@cnpm/banana' });
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

        const userRepository = await app.getEggObject(UserRepository);
        const user = await userRepository.findUserByName('banana');
        const tokens = await userRepository.listTokens(user!.userId);

        let granularToken = tokens.find(token => token.type === TokenType.granular);

        assert(granularToken);
        assert(granularToken.lastUsedAt === null);
        assert.equal(granularToken.name, 'apple');
        assert.deepEqual(granularToken.allowedScopes, [ '@banana' ]);
        const expiredDate = dayjs(granularToken.expiredAt);
        assert(expiredDate.isAfter(dayjs().add(29, 'days')));
        assert(expiredDate.isBefore(dayjs().add(30, 'days')));

        // should ignore granularToken when use v1 query
        res = await app.httpRequest()
          .get('/-/npm/v1/tokens')
          .set('authorization', 'Bearer ' + res.body.token);

        assert(res.body.objects.length > 0);
        assert(res.body.objects.every((token: Token) => token.type !== TokenType.granular));

        // should update lastUsedAt
        res = await app.httpRequest()
          .get('/-/npm/v1/tokens/gat')
          .expect(200);

        granularToken = res.body.objects.find(token => token.type === TokenType.granular);
        assert(granularToken?.lastUsedAt);
        assert(dayjs(granularToken?.lastUsedAt).isAfter(start));

      });

      it('should check for uniq name', async () => {
        await TestUtil.createPackage({ name: '@cnpm/banana' });
        await app.httpRequest()
          .post('/-/npm/v1/tokens/gat')
          .send({
            name: 'apple',
            description: 'lets play',
            allowedPackages: [ '@cnpm/banana' ],
            allowedScopes: [ '@banana' ],
            expires: 30,
          })
          .expect(200);

        const res = await app.httpRequest()
          .post('/-/npm/v1/tokens/gat')
          .send({
            name: 'apple',
            description: 'lets play',
            allowedPackages: [ '@cnpm/banana' ],
            allowedScopes: [ '@banana' ],
            expires: 30,
          });

        assert.match(res.body.error, /ER_DUP_ENTRY/);
      });
    });

  });
});
