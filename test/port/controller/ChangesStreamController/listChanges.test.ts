import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.ts';

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
      await setTimeout(100);
      res = await app.httpRequest().get('/_changes');
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 1, `res.body.results.length: ${res.body.results.length}`);
      assert.equal(res.body.results[0].type, 'PACKAGE_VERSION_ADDED');
      assert.equal(res.body.results[0].id, pkg.name);
      assert.ok(res.body.results[0].seq);
      assert.equal(
        res.body.results[0].changes.length,
        1,
        `res.body.results[0].changes.length: ${res.body.results[0].changes.length}`,
      );

      const since = res.body.results[0].seq;
      res = await app.httpRequest().get('/_changes').query({ since });
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 1, `res.body.results.length: ${res.body.results.length}`);

      await TestUtil.createPackage({ name: '@cnpm/other-package' });
      await setTimeout(100);
      res = await app.httpRequest().get('/_changes').query({ since });
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 2, `res.body.results.length: ${res.body.results.length}`);
      assert.equal(res.body.results[0].type, 'PACKAGE_VERSION_ADDED');

      res = await app.httpRequest().get('/_changes');
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 2, `res.body.results.length: ${res.body.results.length}`);
    });
  });
});
