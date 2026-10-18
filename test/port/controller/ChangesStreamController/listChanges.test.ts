import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app, mock } from '@eggjs/mock/bootstrap';

import { OrgService } from '../../../../app/core/service/OrgService.ts';
import { TeamService } from '../../../../app/core/service/TeamService.ts';
import { ChangesStreamController } from '../../../../app/port/controller/ChangesStreamController.ts';
import { TeamRepository } from '../../../../app/repository/TeamRepository.ts';
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

      // the scan is bounded; last_seq lets consumers resume past omitted events
      mock(ChangesStreamController, 'MAX_SCAN_PAGES', 1);
      res = await app.httpRequest().get('/_changes').query({ since }).expect(200);
      assert.deepEqual(
        res.body.results.map((r: { id: string }) => r.id),
        ['@cnpm/changes-page-a'],
      );
      assert.ok(res.body.last_seq > since, 'last_seq must advance');
      let cursor = res.body.last_seq;
      const seen: string[] = [];
      for (let i = 0; i < 20 && !seen.includes('@cnpm/changes-page-b'); i++) {
        res = await app.httpRequest().get('/_changes').query({ since: cursor }).expect(200);
        seen.push(...res.body.results.map((r: { id: string }) => r.id));
        assert.ok(res.body.last_seq > cursor || seen.includes('@cnpm/changes-page-b'), 'feed must advance');
        cursor = res.body.last_seq;
      }
      assert.ok(!seen.includes('@cnpm/changes-page-private'));
      assert.ok(seen.includes('@cnpm/changes-page-b'));

      // no changes since: no last_seq
      res = await app
        .httpRequest()
        .get('/_changes')
        .query({ since: cursor + 1000 })
        .expect(200);
      assert.deepEqual(res.body, { results: [] });
    });

    it('should emit a change when a team-private package becomes public again', async () => {
      const owner = await TestUtil.createUser({ name: 'changes-unbind-owner' });
      const names = ['@cnpm/changes-unbind-revoke', '@cnpm/changes-unbind-team', '@cnpm/changes-unbind-org'];
      for (const name of names) {
        const pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
        await app
          .httpRequest()
          .put(`/${name}`)
          .set('authorization', owner.authorization)
          .set('user-agent', owner.ua)
          .send(pkg)
          .expect(201);
      }
      for (const team of ['changes-unbind-t1', 'changes-unbind-t2']) {
        await app
          .httpRequest()
          .put('/-/org/cnpm/team')
          .set('authorization', owner.authorization)
          .send({ name: team })
          .expect(200);
      }
      const bind = async (team: string, name: string) => {
        await app
          .httpRequest()
          .put(`/-/team/cnpm/${team}/package`)
          .set('authorization', owner.authorization)
          .send({ package: name })
          .expect(200);
      };
      await bind('changes-unbind-t1', names[0]);
      await bind('changes-unbind-t2', names[1]);
      await bind('changes-unbind-t1', names[2]);
      await bind('changes-unbind-t2', names[2]);
      await setTimeout(100);
      const listIds = async (since = 0) => {
        const res = await app.httpRequest().get('/_changes').query({ since }).expect(200);
        return res.body.results.map((r: { id: string }) => r.id) as string[];
      };
      let ids = await listIds();
      for (const name of names) {
        assert.ok(!ids.includes(name));
      }

      // revoke the only binding
      await app
        .httpRequest()
        .delete('/-/team/cnpm/changes-unbind-t1/package')
        .set('authorization', owner.authorization)
        .send({ package: names[0] })
        .expect(200);
      // remove a team: names[1] becomes public, names[2] still bound to t1
      const teamService = await app.getEggObject(TeamService);
      const orgService = await app.getEggObject(OrgService);
      const org = await orgService.findOrgByName('cnpm');
      assert.ok(org);
      const team2 = await app
        .getEggObject(TeamRepository)
        .then((repo) => repo.findTeam(org.orgId, 'changes-unbind-t2'));
      assert.ok(team2);
      await teamService.removeTeam(team2.teamId);
      await setTimeout(100);
      ids = await listIds();
      assert.ok(ids.includes(names[0]), ids.join(','));
      assert.ok(ids.includes(names[1]), ids.join(','));
      assert.ok(!ids.includes(names[2]), ids.join(','));

      // remove the org: last binding of names[2] goes away
      await orgService.removeOrg(org.orgId);
      await setTimeout(100);
      ids = await listIds();
      assert.ok(ids.includes(names[2]), ids.join(','));
    });
  });
});
