import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/port/controller/UserController/showProfile.test.ts', () => {
  describe('[GET /-/npm/v1/user] showProfile()', () => {
    it('should 401', async () => {
      const { authorization } = await TestUtil.createUser();
      let res = await app.httpRequest().get('/-/npm/v1/user').set('authorization', `${authorization}wrong`);
      assert.ok(res.status === 401);
      assert.ok(res.body.error === '[UNAUTHORIZED] Invalid token');

      res = await app.httpRequest().get('/-/npm/v1/user');
      assert.ok(res.status === 401);
      assert.ok(res.body.error === '[UNAUTHORIZED] Login first');
    });

    it('should 200 with full profile fields', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app.httpRequest().get('/-/npm/v1/user').set('authorization', authorization);
      assert.equal(res.status, 200);
      assert.equal(res.body.name, name);
      assert.equal(res.body.tfa, null);
      assert.equal(res.body.email_verified, false);
      assert.ok(res.body.created);
      assert.ok(res.body.updated);
      assert.equal(res.body.fullname, '');
      assert.equal(res.body.homepage, '');
      assert.equal(res.body.freenode, '');
      assert.equal(res.body.twitter, '');
      assert.equal(res.body.github, '');
    });

    it('should return updated profile fields after save', async () => {
      const { authorization, name } = await TestUtil.createUser();

      // Update profile
      await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({ fullname: 'Test User', github: 'testuser', twitter: 'testtwitter' })
        .expect(200);

      // Verify the profile returns updated data
      const res = await app.httpRequest().get('/-/npm/v1/user').set('authorization', authorization);
      assert.equal(res.status, 200);
      assert.equal(res.body.name, name);
      assert.equal(res.body.fullname, 'Test User');
      assert.equal(res.body.github, 'testuser');
      assert.equal(res.body.twitter, 'testtwitter');
      assert.equal(res.body.homepage, '');
      assert.equal(res.body.freenode, '');
    });
  });
});
