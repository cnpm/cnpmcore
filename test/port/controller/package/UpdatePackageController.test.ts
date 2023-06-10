import { RegistryType } from '../../../../app/common/enum/Registry';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/package/UpdatePackageController.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[PUT /:fullname/-rev/:rev] update()', () => {
    const scopedName = '@cnpm/testmodule-update-package';
    let rev = '';

    beforeEach(async () => {
      const pkg = await TestUtil.getFullPackage({ name: scopedName });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      rev = res.body.rev;
    });

    it('should 404 when pkg not exists', async () => {
      const user = await TestUtil.createUser();
      mock(app.config.cnpmcore, 'admins', { [user.name]: user.email });
      const res = await app.httpRequest()
        .put('/banana/-rev/123')
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        });
      assert.equal(res.statusCode, 404);
    });

    it('should 422 when maintainters empty', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [],
        })
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] maintainers: must NOT have fewer than 1 items');
    });

    it('should 422 when some maintainters not exists', async () => {
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            {
              name: 'foo',
              email: 'foo@bar.com',
            },
          ],
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] Maintainer "foo" not exists');
    });

    it('should 403 request user is not maintainer', async () => {
      const user = await TestUtil.createUser();
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] "${user.name}" not authorized to modify ${scopedName}, please contact maintainers: "${publisher.name}"`);
    });

    it('should 200 request when user is admin and user is not maintainer', async () => {
      const user = await TestUtil.createUser();
      mock(app.config.cnpmcore, 'admins', { [user.name]: user.email });
      const res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(200);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true });
    });

    it('should 200 when without userPrefix', async () => {
      const user = await TestUtil.createUser();
      await TestUtil.createUser({
        name: 'dnpm:banana',
      });

      const registryManagerService = await app.getEggObject(RegistryManagerService);
      const registry = await registryManagerService.createRegistry({
        name: 'dnpmcore',
        changeStream: 'https://d.cnpmjs.org/_changes',
        host: 'https://registry.dnpmmirror.com',
        userPrefix: 'dnpm:',
        type: RegistryType.Cnpmcore,
      });

      await TestUtil.createPackage({
        name: '@cnpm/banana',
        isPrivate: false,
        registryId: registry.registryId,
      });

      mock(app.config.cnpmcore, 'admins', { [user.name]: user.email });
      const updateRes = await app.httpRequest()
        .put('/@cnpm/banana/-rev/1')
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: 'banana', email: user.email },
          ],
        });

      assert.equal(updateRes.statusCode, 200);
      assert.deepEqual(updateRes.body, { ok: true });
    });

    it('should 400 when npm-command invalid', async () => {
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(400);
      assert.equal(res.body.error, '[BAD_REQUEST] header: npm-command expected "owner", but got ""');
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'adduser')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(400);
      assert.equal(res.body.error, '[BAD_REQUEST] header: npm-command expected "owner", but got "adduser"');

      // npm@6: referer: 'xxx [REDACTED]'
      // npm@>=7: 'npm-command': 'xxx'
      // when npm version < 7, npm command can get from referer
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'npm/6.3.1')
        .set('referer', 'addUser add someone [REDACTED]')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(400);
      assert.equal(res.body.error, '[BAD_REQUEST] header: npm-command expected "owner", but got "addUser"');
    });

    it('should 200 when npm command is npm owner add', async () => {
      mock(app.config.cnpmcore, 'enableNpmClientAndVersionCheck', false);
      // npm@6: referer: 'xxx [REDACTED]'
      // npm@>=7: 'npm-command': 'xxx'

      // npm version < 7
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', 'npm/6.3.1')
        .set('referer', 'owner add someone [REDACTED]')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(200);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true });

      // npm version >= 7
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'npm/7.3.1')
        .set('referer', '')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(200);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true });
    });

    it('should 403 when npm client invalid', async () => {
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', '')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Only allow npm client to access');

      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'npm/6.3.1')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Only allow npm@>=7.0.0 client to access');
    });

    it('should 200 when enableNpmClientAndVersionCheck is false', async () => {
      mock(app.config.cnpmcore, 'enableNpmClientAndVersionCheck', false);
      const user = await TestUtil.createUser();
      mock(app.config.cnpmcore, 'admins', { [user.name]: user.email });
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', '')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(200);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true });
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'npm/6.3.1')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(200);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true });
    });

    it('should 403 when enableNpmClientAndVersionCheck is true', async () => {
      mock(app.config.cnpmcore, 'enableNpmClientAndVersionCheck', true);
      const user = await TestUtil.createUser();
      mock(app.config.cnpmcore, 'admins', { [user.name]: user.email });
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', '')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, '[FORBIDDEN] Only allow npm client to access');
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'npm/6.3.1')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, '[FORBIDDEN] Only allow npm@>=7.0.0 client to access');
    });

    it('should 200 and get latest maintainers', async () => {
      let res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 1);

      const user = await TestUtil.createUser();
      const user2 = await TestUtil.createUser();
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 3);

      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: user2.name, email: user2.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${scopedName}`)
        .expect(200);
      assert.equal(res.body.maintainers.length, 2);

      // publisher is remove from maintainers
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] \"${publisher.name}\" not authorized to modify ${scopedName}, please contact maintainers: \"${user.name}, ${user2.name}\"`);
    });

    it('should support pnpm and other npm clients', async () => {
      const user = await TestUtil.createUser();
      let res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', user.authorization)
        .set('user-agent', 'pnpm/7.0.0 npm/6.3.1')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
          ],
        })
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Only allow npm@>=7.0.0 client to access');

      // should valid with pnpm6 and npm>10
      res = await app.httpRequest()
        .put(`/${scopedName}/-rev/${rev}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', 'pnpm/6.0.0 npm/17.1.0')
        .set('npm-command', 'owner')
        .send({
          _id: rev,
          _rev: rev,
          maintainers: [
            { name: user.name, email: user.email },
            { name: publisher.name, email: publisher.email },
          ],
        })
        .expect(200);
      assert.equal(res.body.ok, true);
    });
  });
});
