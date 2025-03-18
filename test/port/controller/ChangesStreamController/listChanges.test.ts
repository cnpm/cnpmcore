import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';

describe('test/port/controller/ChangesStreamController/listChanges.test.ts', () => {
  describe('[GET /_changes] listChanges()', () => {
    it('should 422 when since is not number', async () => {
      const res = await app.httpRequest().get('/_changes?since=abc');
      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[INVALID_PARAM] since: must be integer');
    });

    it('should 200', async () => {
      let res = await app.httpRequest().get('/_changes');
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 0);
      res = await app.httpRequest().get('/_changes?since=100');
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 0);

      const { pkg } = await TestUtil.createPackage();
      res = await app.httpRequest().get('/_changes');
      assert.equal(res.status, 200);
      assert(res.body.results.length > 0);
      assert.equal(res.body.results[0].type, 'PACKAGE_VERSION_ADDED');
      assert.equal(res.body.results[0].id, pkg.name);
      assert(res.body.results[0].seq);
      assert(res.body.results[0].changes.length > 0);

      const since = res.body.results[0].seq;
      res = await app.httpRequest().get('/_changes').query({ since });
      assert.equal(res.status, 200);
      assert(res.body.results.length > 0);

      await TestUtil.createPackage({ name: '@cnpm/other-package' });
      res = await app.httpRequest().get('/_changes').query({ since });
      assert.equal(res.status, 200);
      assert(res.body.results.length > 0);
      assert.equal(res.body.results[0].type, 'PACKAGE_VERSION_ADDED');

      res = await app.httpRequest().get('/_changes');
      assert.equal(res.status, 200);
      assert(res.body.results.length > 0);
    });
  });
});
