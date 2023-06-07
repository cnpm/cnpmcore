import assert from 'assert';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';
import { Scope } from '../../../../app/core/entity/Scope';

describe('test/port/controller/ScopeController/index.test.ts', () => {
  let adminUser: any;
  let registryManagerService: RegistryManagerService;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    registryManagerService = await app.getEggObject(RegistryManagerService);
    // create registry
    await registryManagerService.createRegistry({
      name: 'custom',
      host: 'https://r.cnpmjs.org/',
      changeStream: 'https://r.cnpmjs.org/_changes',
      userPrefix: 'cnpm:',
      type: RegistryType.Cnpmcore,
    });
  });

  describe('[POST /-/scope] createScope()', () => {
    it('should 200', async () => {

      const queryRes = await registryManagerService.listRegistries({});
      const [ registry ] = queryRes.data;

      // create success
      const res = await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: '@cnpm',
            registryId: registry.registryId,
          })
        .expect(200);

      assert(res.body.ok);
    });

    it('should 400', async () => {
      const res = await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: '@cnpmbanana',
            registryId: 'banana',
          })
        .expect(400);

      assert(res.body.error === '[BAD_REQUEST] registry banana not found');
    });

    it('should 403', async () => {
      // create success
      const res = await app.httpRequest()
        .post('/-/scope')
        .send(
          {
            name: '@cnpm',
          })
        .expect(403);

      assert(res.body.error === '[FORBIDDEN] Not allow to access');
    });

  });

  describe('[DELETE /-/scope/:id] deleteScope()', () => {
    let scope: Scope;
    beforeEach(async () => {
      const queryRes = await registryManagerService.listRegistries({});
      const registry = queryRes.data[0];
      let res = await app.httpRequest()
        .post('/-/scope')
        .set('authorization', adminUser.authorization)
        .send(
          {
            name: '@cnpmjsa',
            registryId: registry.registryId,
          });
      res = await app.httpRequest()
        .get(`/-/registry/${registry.registryId}/scopes`);

      scope = res.body.data[0];
    });
    it('should 200', async () => {
      const res = await app.httpRequest()
        .delete(`/-/scope/${scope.scopeId}`)
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert(res.body.ok);
    });
  });
});
