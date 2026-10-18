import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app, mock } from '@eggjs/mock/bootstrap';

import { ChangesStreamController } from '../../../../app/port/controller/ChangesStreamController.ts';
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

    it('should omit team-private package events from the public feed', async () => {
      const victim = await TestUtil.createUser({ name: 'changes-victim-priv' });
      const publicPkg = await TestUtil.getFullPackage({ name: '@cnpm/changes-public', version: '1.0.0' });
      const privatePkg = await TestUtil.getFullPackage({ name: '@cnpm/changes-private', version: '1.0.0' });
      await app
        .httpRequest()
        .put(`/${publicPkg.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(publicPkg)
        .expect(201);
      await app
        .httpRequest()
        .put(`/${privatePkg.name}`)
        .set('authorization', victim.authorization)
        .set('user-agent', victim.ua)
        .send(privatePkg)
        .expect(201);
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', victim.authorization)
        .send({ name: 'changes-vteam' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/changes-vteam/package')
        .set('authorization', victim.authorization)
        .send({ package: privatePkg.name })
        .expect(200);

      await setTimeout(100);
      const res = await app.httpRequest().get('/_changes').expect(200);
      const ids = res.body.results.map((r: { id: string }) => r.id);
      assert.ok(ids.includes(publicPkg.name), `expected public package in feed, got ${ids.join(',')}`);
      assert.ok(!ids.includes(privatePkg.name), `private package must not appear in public _changes`);
    });

    it('should keep advancing past omitted team-private events', async () => {
      mock(ChangesStreamController, 'PAGE_SIZE', 2);
      const owner = await TestUtil.createUser({ name: 'changes-page-owner' });
      const publish = async (name: string, version: string) => {
        const pkg = await TestUtil.getFullPackage({ name, version });
        await app
          .httpRequest()
          .put(`/${name}`)
          .set('authorization', owner.authorization)
          .set('user-agent', owner.ua)
          .send(pkg)
          .expect(201);
      };
      await publish('@cnpm/changes-page-a', '1.0.0');
      await publish('@cnpm/changes-page-private', '1.0.0');
      await app
        .httpRequest()
        .put('/-/org/cnpm/team')
        .set('authorization', owner.authorization)
        .send({ name: 'changes-page-team' })
        .expect(200);
      await app
        .httpRequest()
        .put('/-/team/cnpm/changes-page-team/package')
        .set('authorization', owner.authorization)
        .send({ package: '@cnpm/changes-page-private' })
        .expect(200);
      for (const version of ['1.0.1', '1.0.2', '1.0.3']) {
        await publish('@cnpm/changes-page-private', version);
      }
      await publish('@cnpm/changes-page-b', '1.0.0');
      await setTimeout(100);

      let res = await app.httpRequest().get('/_changes').expect(200);
      let ids: string[] = res.body.results.map((r: { id: string }) => r.id);
      assert.ok(!ids.includes('@cnpm/changes-page-private'));
      assert.equal(ids[0], '@cnpm/changes-page-a');
      // page is filled with the next public event instead of stopping at omitted ones
      assert.equal(ids.at(-1), '@cnpm/changes-page-b');

      // resuming from the last public seq before a run of private events still advances
      const since = res.body.results[0].seq;
      res = await app.httpRequest().get('/_changes').query({ since }).expect(200);
      ids = res.body.results.map((r: { id: string }) => r.id);
      assert.ok(!ids.includes('@cnpm/changes-page-private'));
      assert.ok(res.body.results.at(-1).seq > since, 'feed must advance');
      assert.equal(ids.at(-1), '@cnpm/changes-page-b');

      // with a bounded scan, a request that already advanced may stop early...
      mock(ChangesStreamController, 'MAX_SCAN_PAGES', 1);
      res = await app.httpRequest().get('/_changes').expect(200);
      ids = res.body.results.map((r: { id: string }) => r.id);
      assert.deepEqual(ids, ['@cnpm/changes-page-a']);
      // ...but resuming from that seq keeps scanning until the feed advances
      res = await app.httpRequest().get('/_changes').query({ since }).expect(200);
      ids = res.body.results.map((r: { id: string }) => r.id);
      assert.ok(!ids.includes('@cnpm/changes-page-private'));
      assert.equal(ids.at(-1), '@cnpm/changes-page-b');
    });
  });
});
