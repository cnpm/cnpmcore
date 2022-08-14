import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';

describe('test/port/controller/RegistryController/curd.test.ts', () => {
  let ctx: Context;
  let adminUser: any;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    adminUser = await TestUtil.createAdmin();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  describe('[POST /-/registry] createRegistry()', () => {
    it('should 200', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(200);

      assert(res.body.ok);
    });

    it('should verify params', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(422);

      assert(res.body.error === `[INVALID_PARAM] must have required property 'host'`);
    });

    it('should unique the scope and name', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs", "@cnpm"],
            "type": 'cnpmcore',
          })
        .expect(200);

      assert(res.body.ok);

      // create conflict name
      const nameRes = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs", "@cnpm"],
            "type": 'cnpmcore',
          })
        .expect(500);

      assert(nameRes.body.error === `[ER_DUP_ENTRY] ER_DUP_ENTRY: Duplicate entry 'custom' for key 'registries.uk_name'`);

      // create conflict scope
      const scopeRes = await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom2",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(500);

      assert(scopeRes.body.error === `[ER_DUP_ENTRY] ER_DUP_ENTRY: Duplicate entry '@cnpm' for key 'scopes.uk_name'`);
    });

    it('should 403', async () => {
      // create forbidden
      const res = await app.httpRequest()
        .post('/-/registry')
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(403);

      assert(res.body.error === '[FORBIDDEN] Not allow to create registry');
    });

  });

  describe('[GET /-/registry] createRegistry()', () => {
    it('should 200', async () => {
      // create success
      await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(200);

      // query success
      const res = await app.httpRequest()
        .get('/-/registry')
        .expect(200);

      assert(res.body.length === 1);
      assert(res.body[0].name === 'custom');
      assert.deepEqual(res.body[0].scopes.map(scope => scope.name), ['@cnpm', '@cnpmjs']);
    });
  });

  describe('[DELETE /-/registry] deleteRegistry()', () => {
    it('should 200', async () => {
      // create success
      await app.httpRequest()
        .post('/-/registry')
        .set('authorization', adminUser.authorization)
        .send(
          {
            "name": "custom",
            "host": "https://r.cnpmjs.org/",
            "changeStream": "https://r.cnpmjs.org/_changes",
            "scopes": ["@cnpm", "@cnpmjs"],
            "type": 'cnpmcore',
          })
        .expect(200);

      await app.httpRequest()
        .delete('/-/registry')
        .send({
          name: 'custom',
        }).expect(403);

      await app.httpRequest()
        .delete('/-/registry')
        .set('authorization', adminUser.authorization)
        .send({
          name: 'custom',
        }).expect(200);

      // query success
      const res = await app.httpRequest()
        .get('/-/registry')
        .set('authorization', adminUser.authorization)
        .expect(200);

      assert(res.body.length === 0);
    });
  });
});
