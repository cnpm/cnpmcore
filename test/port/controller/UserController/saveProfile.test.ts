import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/port/controller/UserController/saveProfile.test.ts', () => {
  describe('[POST /-/npm/v1/user] saveProfile()', () => {
    it('should 401 without authorization', async () => {
      const res = await app.httpRequest().post('/-/npm/v1/user');
      assert.equal(res.status, 401);
    });

    it('should 200 and update fullname', async () => {
      const { authorization, name } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({ fullname: 'New Full Name' })
        .expect(200);

      assert.equal(res.body.name, name);
      assert.equal(res.body.fullname, 'New Full Name');
      assert.equal(res.body.tfa, null);
      assert.ok(res.body.created);
      assert.ok(res.body.updated);
    });

    it('should 200 and update all profile fields', async () => {
      const { authorization } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({
          fullname: 'Full Name',
          homepage: 'https://example.com',
          freenode: 'myirc',
          twitter: 'mytwitter',
          github: 'mygithub',
        })
        .expect(200);

      assert.equal(res.body.fullname, 'Full Name');
      assert.equal(res.body.homepage, 'https://example.com');
      assert.equal(res.body.freenode, 'myirc');
      assert.equal(res.body.twitter, 'mytwitter');
      assert.equal(res.body.github, 'mygithub');
    });

    it('should 200 and only update provided fields', async () => {
      const { authorization } = await TestUtil.createUser();

      // Set initial values
      await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({ fullname: 'Initial Name', github: 'initialgh' })
        .expect(200);

      // Update only twitter
      const res = await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({ twitter: 'newtwitter' })
        .expect(200);

      // fullname and github should remain unchanged
      assert.equal(res.body.fullname, 'Initial Name');
      assert.equal(res.body.github, 'initialgh');
      assert.equal(res.body.twitter, 'newtwitter');
    });

    it('should 200 with empty body (no-op update)', async () => {
      const { authorization } = await TestUtil.createUser();
      const res = await app.httpRequest()
        .post('/-/npm/v1/user')
        .set('authorization', authorization)
        .send({})
        .expect(200);
      assert.ok(res.body.name);
    });
  });
});
