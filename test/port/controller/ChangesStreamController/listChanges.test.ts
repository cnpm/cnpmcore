import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/ChangesStreamController/listChanges.test.ts', () => {
  describe('[GET /_changes] listChanges()', () => {
    it('should 422 when since is not number', async () => {
      const res = await app.httpRequest()
        .get('/_changes?since=abc');
      assert(res.status === 422);
      assert(res.body.error === '[INVALID_PARAM] since: must be integer');
    });

    it('should 200', async () => {
      let res = await app.httpRequest()
        .get('/_changes');
      assert(res.status === 200);
      assert(res.body.results.length === 0);
      res = await app.httpRequest()
        .get('/_changes?since=100');
      assert(res.status === 200);
      assert(res.body.results.length === 0);

      const { pkg } = await TestUtil.createPackage();
      const eventWaiter = await app.getEventWaiter();
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      res = await app.httpRequest()
        .get('/_changes');
      assert(res.status === 200);
      assert(res.body.results.length === 1);
      assert(res.body.results[0].type === 'PACKAGE_VERSION_ADDED');
      assert(res.body.results[0].id === pkg.name);
      assert(res.body.results[0].seq);
      assert(res.body.results[0].changes.length === 1);

      const since = res.body.results[0].seq;
      res = await app.httpRequest()
        .get('/_changes')
        .query({ since });
      assert(res.status === 200);
      assert(res.body.results.length === 1);

      await TestUtil.createPackage({ name: '@cnpm/other-package' });
      await eventWaiter.await('PACKAGE_VERSION_ADDED');
      res = await app.httpRequest()
        .get('/_changes')
        .query({ since });
      assert(res.status === 200);
      assert(res.body.results.length === 2);
      assert(res.body.results[0].type === 'PACKAGE_VERSION_ADDED');

      res = await app.httpRequest()
        .get('/_changes');
      assert(res.status === 200);
      assert(res.body.results.length === 2);
    });
  });
});
