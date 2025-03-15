import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../TestUtil.js';

describe('test/port/middleware/AlwaysAuth.test.ts', () => {
  it('should 401 when config.cnpmcore.alwaysAuth = true', async () => {
    mock(app.config.cnpmcore, 'alwaysAuth', true);
    let res = await app.httpRequest().get('/foo').expect(401);
    assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    res = await app.httpRequest().get('/@cnpm/foo').expect(401);
    assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
  });

  it('should pass on logined user when config.cnpmcore.alwaysAuth = true', async () => {
    mock(app.config.cnpmcore, 'alwaysAuth', true);
    const { authorization, name } = await TestUtil.createUser();
    const res = await app
      .httpRequest()
      .get('/-/whoami')
      .set('authorization', authorization)
      .expect(200);
    assert.deepEqual(res.body, { username: name });
  });

  it('should pass when config.cnpmcore.alwaysAuth = false', async () => {
    const res = await app.httpRequest().get('/@cnpm/foo').expect(404);
    assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foo not found');
  });

  it('should ignore alwaysAuth on login request', async () => {
    mock(app.config.cnpmcore, 'alwaysAuth', true);
    // PUT
    let res = await app
      .httpRequest()
      .put('/-/user/org.couchdb.user:leo')
      .send({
        password: 'password-is-here',
        type: 'user',
      })
      .expect(422);
    assert.equal(
      res.body.error,
      "[INVALID_PARAM] must have required property 'name'"
    );

    // GET
    res = await app
      .httpRequest()
      .get('/-/user/org.couchdb.user:leo')
      .expect(401);
    assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
  });
});
