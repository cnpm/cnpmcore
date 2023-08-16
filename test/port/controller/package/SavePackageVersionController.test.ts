import assert from 'assert';
import { setTimeout } from 'node:timers/promises';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { UserRepository } from '../../../../app/repository/UserRepository';
import { calculateIntegrity } from '../../../../app/common/PackageUtil';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import { UserService } from '../../../../app/core/service/UserService';
import { Token, TokenType } from '../../../../app/core/entity/Token';
import { Token as TokenModel } from '../../../../app/repository/model/Token';
import { User } from '../../../../app/core/entity/User';
import dayjs from 'dayjs';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { ForbiddenError } from 'egg-errors';

describe('test/port/controller/package/SavePackageVersionController.test.ts', () => {
  let userRepository: UserRepository;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    userRepository = await app.getEggObject(UserRepository);
  });

  describe('[PUT /:fullname] save()', () => {
    it('should set registry field after publish', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const { pkg, user } = await TestUtil.createPackage({ name: 'non_scope_pkg', version: '1.0.0' });
      const pkg2 = await TestUtil.getFullPackage({ name: pkg.name, version: '2.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg2);

      assert.equal(res.status, 201);

      res = await app.httpRequest()
        .get(`/${pkg2.name}`)
        .expect(200);

      const fullManifest = res.body;

      res = await app.httpRequest()
        .get(`/${pkg2.name}`)
        .set('Accept', 'application/vnd.npm.install-v1+json')
        .expect(200);

      const abbreviatedManifest = res.body;

      [ fullManifest, abbreviatedManifest ].forEach(manifest => {
        Object.keys(manifest.versions).forEach(v => {
          const version = manifest.versions[v];
          assert(version);
          assert.equal(version._source_registry_name, 'self');
          assert(version.publish_time);
        });
      });

      Object.keys(fullManifest.versions).forEach(v => {
        const version = fullManifest.versions[v];
        assert(version);
        assert(version._cnpmcore_publish_time);
        assert.deepEqual(version._npmUser, {
          name: user.name,
          email: user.email,
        });
      });

    });
    it('should 200 when package in current registry', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const { pkg, user } = await TestUtil.createPackage({ name: 'non_scope_pkg', version: '1.0.0' });
      const pkg2 = await TestUtil.getFullPackage({ name: pkg.name, version: '2.0.0' });
      const res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg2);

      assert.equal(res.status, 201);
      const packageRepository = await app.getEggObject(PackageRepository);
      const pkgEntity = await packageRepository.findPackage('', pkg.name);

      const registryManagerService = await app.getEggObject(RegistryManagerService);
      const selfRegistry = await registryManagerService.ensureSelfRegistry();

      assert(pkgEntity);
      assert.equal(pkgEntity.registryId, selfRegistry.registryId);
    });

    it('should 409 when lock failed', async () => {
      const { pkg, user } = await TestUtil.createPackage({ name: '@cnpm/banana', version: '1.0.0' });

      const packageManagerService = await app.getEggObject(PackageManagerService);

      mock(packageManagerService, 'publish', async () => {
        await setTimeout(50);
        throw new ForbiddenError('mock error');
      });

      const [ errorRes, conflictRes ] = await Promise.all([
        app.httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', user.authorization)
          .set('user-agent', user.ua)
          .send(pkg),
        (async () => {
          await setTimeout(10);
          return app.httpRequest()
            .put(`/${pkg.name}`)
            .set('authorization', user.authorization)
            .set('user-agent', user.ua)
            .send(pkg);
        })(),
      ]);
      assert(errorRes.error, '[FORBIDDEN] mock error');
      assert.equal(conflictRes.status, 409);
      assert(conflictRes.error, '[CONFLICT] Unable to create the publication lock, please try again later.');

      // release lock
      await setTimeout(50);
      const nextErrorRes = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg);
      assert(nextErrorRes.error, '[FORBIDDEN] mock error');

    });

    it('should verify tgz and manifest', async () => {
      const { pkg, user } = await TestUtil.createPackage({ name: '@cnpm/banana', version: '1.0.0' });
      const pkg2 = await TestUtil.getFullPackage({ name: pkg.name, version: '0.0.1' });

      pkg2.versions['0.0.1'].name = '@cnpm/orange';

      mock(app.config.cnpmcore, 'strictValidateTarballPkg', true);
      const res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg2)
        .expect(422);

      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] name mismatch between tarball and manifest');
    });
    it('should verify tgz and manifest with multiple fields', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const { pkg, user } = await TestUtil.createPackage({ name: 'non_scope_pkg', version: '1.0.0' });
      const pkg2 = await TestUtil.getFullPackage({ name: pkg.name, version: '0.0.1' });

      pkg2.versions['0.0.1'].dependencies = { lodash: 'latest' };

      mock(app.config.cnpmcore, 'strictValidateTarballPkg', true);
      const res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg2)
        .expect(422);

      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] name,dependencies mismatch between tarball and manifest');
    });

    it('should add new version success on scoped package', async () => {
      const name = '@cnpm/publish-package-test';
      const pkg = await TestUtil.getFullPackage({ name, version: '0.0.0', description: 'init description' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert(res.body.description === 'init description');
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert(res.body['dist-tags'].latest === '0.0.0');
      assert(res.body.description === 'init description');

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg2)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkg3 = await TestUtil.getFullPackage({ name, version: '2.0.0', description: '2.0.0 description' });
      res = await app.httpRequest()
        .put(`/${encodeURIComponent(pkg3.name)}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg3)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}/2.0.0`)
        .expect(200);
      assert(res.body.version === '2.0.0');
      assert(res.body.description === '2.0.0 description');
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert(res.body['dist-tags'].latest === '2.0.0');
      assert(res.body.description === '2.0.0 description');
    });

    it('should 403 on not allow scoped package', async () => {
      const name = '@somescope/publish-package-test';
      let pkg = await TestUtil.getFullPackage({ name });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Scope "@somescope" not match legal scopes: "@cnpm, @cnpmcore, @example"');
      pkg = await TestUtil.getFullPackage({ name: 'foo' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(403);
      assert.equal(res.body.error, '[FORBIDDEN] Package scope required, legal scopes: "@cnpm, @cnpmcore, @example"');
    });

    it('should 200 when migrate scoped package', async () => {
      const name = '@cnpm/publish-package-test';
      let pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      assert(res);
      const packageRepository = await app.getEggObject(PackageRepository);
      let pkgEntity = await packageRepository.findPackage('@cnpm', 'publish-package-test');
      assert(pkgEntity);
      pkgEntity.registryId = '';
      await packageRepository.savePackage(pkgEntity!);

      res = await app.httpRequest()
        .get(`/${pkg.name}`);
      assert.equal(res.body._source_registry_name, 'default');

      pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      pkgEntity = await packageRepository.findPackage('@cnpm', 'publish-package-test');
      assert(pkgEntity?.registryId);

      res = await app.httpRequest()
        .get(`/${pkg.name}`);
      assert.equal(res.body._source_registry_name, 'self');
    });

    it('should publish on user custom scopes', async () => {
      // add user.scopes
      const user = await userRepository.findUserByName(publisher.name);
      assert(user);
      user.scopes = [ '@somescope' ];
      await userRepository.saveUser(user);
      const name = '@somescope/publish-package-test';
      const pkg = await TestUtil.getFullPackage({ name });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should publish 102 chars length version', async () => {
      // https://github.com/cnpm/cnpmcore/issues/36
      const user = await userRepository.findUserByName(publisher.name);
      assert(user);
      user.scopes = [ '@inrupt' ];
      await userRepository.saveUser(user);
      const name = '@inrupt/solid-client';
      const version = '0.0.2-dependabotnpmandyarnwebsitedocusauruspreset-classic-200-alpha61-192892303-618.0';
      const pkg = await TestUtil.getFullPackage({ name, version });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.equal(res.body.versions[version].version, version);
    });

    it('should publish 100+ chars length name', async () => {
      // https://github.com/cnpm/cnpmcore/issues/36
      const user = await userRepository.findUserByName(publisher.name);
      assert(user);
      user.scopes = [ '@inrupt' ];
      await userRepository.saveUser(user);
      const name = '@inrupt/solid-client-0.0.2-dependabotnpmandyarnwebsitedocusauruspreset-classic-200-alpha61-192892303-618.0';
      const version = '0.0.2-200-alpha61-192892303-618.0';
      const pkg = await TestUtil.getFullPackage({ name, version });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.equal(res.body.versions[version].version, version);
    });

    it('should publish with 4mb tarball', async () => {
      const tarball = Buffer.alloc(4 * 1024 * 1024);
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
    });

    // unstable on supertest, will random fail with Error: write ECONNRESET
    it.skip('should publish fail and response status 413 when tarball >= 10mb', async () => {
      const tarball = Buffer.alloc(10 * 1024 * 1024);
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(413);
      console.log(res.body, res.text, res.headers);
    });

    it('should add new version success', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      // add other version
      const pkg2 = await TestUtil.getFullPackage({ version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg2)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
    });

    it('should 422 when dist-tags version not match', async () => {
      const pkg = await TestUtil.getFullPackage({
        version: '0.0.0',
        distTags: {
          beta: '0.1.0',
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist-tags version "0.1.0" not match package version "0.0.0"');
    });

    it('should 422 when dist-tags format error', async () => {
      let pkg = await TestUtil.getFullPackage({
        version: '0.0.0',
        distTags: {},
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist-tags is empty');

      pkg = await TestUtil.getFullPackage({
        version: '0.0.0',
        distTags: null,
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] dist-tags: must be object');

      pkg = await TestUtil.getFullPackage({
        version: '0.0.0',
        distTags: {
          '0.0': '0.0.0',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] tag: must match format "semver-tag"');
    });

    it('should 404 save deprecated message when package not exists', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);

      const notExistsName = `${pkg.name}-not-exists`;
      res = await app.httpRequest()
        .put(`/${notExistsName}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: notExistsName,
          versions: {
            '0.0.0': {
              version: '0.0.0',
              name: notExistsName,
              deprecated: 'is deprecated, 模块被抛弃, work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            },
          },
        })
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/testmodule-not-exists not found');
    });

    it('should 403 save deprecated message when other user request', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);

      const other = await TestUtil.createUser();
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', other.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: pkg.name,
          versions: {
            '0.0.0': {
              version: '0.0.0',
              name: pkg.name,
              deprecated: 'is deprecated, 模块被抛弃, work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            },
          },
        })
        .expect(403);
      assert.match(res.body.error, /not authorized to modify @cnpm\/testmodule, please contact maintainers/);
    });

    it('should save package version deprecated message', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '0.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);

      const deprecated = 'is deprecated, 模块被抛弃, work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻';
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: pkg.name,
          versions: {
            '0.0.0': {
              version: '0.0.0',
              name: pkg.name,
              deprecated,
            },
            '1.0.0': {
              version: '1.0.0',
              name: pkg.name,
              deprecated,
            },
          },
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.deprecated, deprecated);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.equal(res.body.versions['0.0.0'].deprecated, deprecated);
      assert(!res.body.versions['1.0.0']);

      // remove deprecated message
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: pkg.name,
          versions: {
            '0.0.0': {
              version: '0.0.0',
              name: pkg.name,
              deprecated: '',
            },
            '1.0.0': {
              version: '1.0.0',
              name: pkg.name,
              deprecated: '',
            },
          },
        })
        .expect(200);
      assert.equal(res.body.ok, true);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.deprecated, undefined);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.equal(res.body.versions['0.0.0'].deprecated, undefined);
      assert(!res.body.versions['1.0.0']);
    });

    it('should add new version without dist success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/without-dist', version: '0.0.0' });
      assert(pkg.versions);
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].dist = undefined;
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, 'ERROR: No README data found!');
    });

    it('should add new version without readme success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/without-readme', version: '0.0.0', readme: null });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, '');
    });

    it('should add new version with libc field success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/without-readme', version: '0.0.0', libc: [ 'glibc' ] });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .expect(200);
      assert.deepStrictEqual(res.body.versions['0.0.0'].libc, [ 'glibc' ]);

      res = await app.httpRequest()
        .get(`/${pkg.name}`)
        .set('accept', 'application/vnd.npm.install-v1+json')
        .expect(200);
      assert.deepStrictEqual(res.body.versions['0.0.0'].libc, [ 'glibc' ]);
    });

    it('should add new version without readme(object type) success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/with-readme-object', version: '0.0.0' });
      assert(pkg.versions);
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].readme = { foo: 'bar' };
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.readme, '');
    });

    it('should add new version without description(object type) success', async () => {
      const pkg = (await TestUtil.getFullPackage({ name: '@cnpm/with-description-object', version: '0.0.0' })) as any;
      const version = Object.keys(pkg.versions)[0];
      (pkg.versions[version] as any).description = { foo: 'bar' };
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/0.0.0`)
        .expect(200);
      assert.equal(res.body.version, '0.0.0');
      assert.equal(res.body.description, '');
    });

    it('should add same version throw error', async () => {
      const pkg = await TestUtil.getFullPackage({ version: '99.0.0' });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
      res = await app.httpRequest()
        .get(`/${pkg.name}/99.0.0`)
        .expect(200);
      assert.equal(res.body.version, '99.0.0');

      // add other version
      const pkg2 = await TestUtil.getFullPackage({ version: '99.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg2)
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] Can\'t modify pre-existing version: ${pkg2.name}@99.0.0`);
    });

    it('should 422 when version format error', async () => {
      const pkg = await TestUtil.getFullPackage({
        version: '1.0.woring-version',
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] version: must match format "semver-version"');
    });

    it('should 422 when version empty error', async () => {
      let pkg = await TestUtil.getFullPackage({
        version: '    ',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[INVALID_PARAM] version: must NOT have fewer than 5 characters');

      // auto fix trim empty string
      pkg = await TestUtil.getFullPackage({
        version: ' 1.0.0   ',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      assert.equal(res.body.ok, true);
    });

    it('should 422 when name format error', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      let pkg = await TestUtil.getFullPackage({
        name: 'excited!',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert(res.status === 422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain special characters ("~\'!()*")');

      pkg = await TestUtil.getFullPackage({
        name: ' leading-space:and:weirdchars',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert(res.status === 422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can only contain URL-friendly characters');

      pkg = await TestUtil.getFullPackage({
        name: 'eLaBorAtE-paCkAgE-with-mixed-case-and-more-than-214-characters-----------------------------------------------------------------------------------------------------------------------------------------------------------',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert(res.status === 422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain more than 214 characters, name can no longer contain capital letters');
    });

    it('should allow to publish exists pkg', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const packageManagerService = await app.getEggObject(PackageManagerService);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/LegacyName',
      });
      const user = await userRepository.findUserByName(publisher.name);
      await packageManagerService.publish({
        scope: '@cnpm',
        name: 'LegacyName',
        version: '1.0.0',
        description: '-',
        packageJson: pkg,
        readme: '',
        dist: {
          content: Buffer.from('', 'base64'),
        },
        tag: 'latest',
        isPrivate: true,
      }, user!);


      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert(res.status === 201);

    });

    it('should 422 when attachment data format invalid', async () => {
      let pkg = await TestUtil.getFullPackage({
        attachment: {
          data: null,
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: 'xyz.ddd!',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data string format invalid');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: '',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');
    });

    it('should 422 when attachment size not match', async () => {
      let pkg = await TestUtil.getFullPackage({
        attachment: {
          length: 3,
        },
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment size 3 not match download size 251');

      pkg = await TestUtil.getFullPackage({
        attachment: {
          data: 'H4sIAAAAAAAAA+2SsWrDMBCGPfspDg2Zine123OyEgeylg6Zau2YR8rVRHEtGkkOg5N0jWaFdujVQAv6W4/7/',
        },
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment size 251 not match download size 63');
    });

    it('should 422 dist.integrity invalid', async () => {
      const pkg = await TestUtil.getFullPackage({
        dist: {
          integrity: 'sha512-n+4CQg0Rp1Qo0p9a0R5E5io67T9iD3Lcgg6exmpmt0s8kd4XcOoHu2kiu6U7xd69c',
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.integrity invalid');
    });

    it('should 422 dist.shasum invalid', async () => {
      const pkg = await TestUtil.getFullPackage({
        dist: {
          integrity: undefined,
          shasum: 'wrongshasum',
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);

      assert.equal(res.status, 422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.shasum invalid');
    });

    it('should 422 when name not match pkg.name', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage();
      const res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] fullname(foo) not match package.name(@cnpm/testmodule)');
    });

    it('should 422 _attachments is empty', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {},
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: null,
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] _attachments is empty');
    });

    it('should 422 versions is empty', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: {},
          _attachments: {},
          'dist-tags': {},
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] versions is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: [],
          _attachments: {},
          'dist-tags': {},
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] versions is empty');
    });

    it('should 422 dist-tags is empty', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      let res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist-tags is empty');

      res = await app.httpRequest()
        .put('/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send({
          name: 'foo',
          'dist-tags': {},
          versions: {
            '1.0.0': {
              name: 'foo',
              version: '1.0.0',
            },
          },
          _attachments: {
            name: 'foo',
            version: '1.0.0',
          },
        })
        .expect(422);
      assert(res.body.error === '[UNPROCESSABLE_ENTITY] dist-tags is empty');
    });

    it('should 402 when star / unstar request', async () => {
      let res = await app.httpRequest()
        .put('/@cnpm/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'star')
        .send({});
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm star is not allowed');

      res = await app.httpRequest()
        .put('/@cnpm/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('npm-command', 'unstar')
        .send({});
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm unstar is not allowed');

      res = await app.httpRequest()
        .put('/@cnpm/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('referer', 'star [REDACTED]')
        .send({});
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm star is not allowed');

      res = await app.httpRequest()
        .put('/@cnpm/foo')
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('referer', 'unstar [REDACTED]')
        .send({});
      assert(res.status === 403);
      assert(res.body.error === '[FORBIDDEN] npm unstar is not allowed');
    });

    describe('granular token', async () => {
      let token:Token;
      let userService: UserService;
      let user: User | null;

      beforeEach(async () => {
        userService = await app.getEggObject(UserService);

        user = await userService.findUserByName(publisher.name);
        assert(user);
        token = await userService.createToken(user.userId, {
          name: publisher.name,
          type: TokenType.granular,
          allowedPackages: [ '@dnpm/foo' ],
          allowedScopes: [ '@cnpm', '@cnpmjs' ],
          expires: 1,
        });

      });

      it('should 401 when expired', async () => {
        await TokenModel.update({
          tokenId: token.tokenId,
        }, {
          expiredAt: dayjs(token.createdAt).add(1, 'millisecond').toDate(),
        });

        const name = '@cnpm/new_pkg';
        const pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
        const res = await app.httpRequest()
          .put(`/${name}`)
          .set('authorization', `Bearer ${token.token}`)
          .set('user-agent', publisher.ua)
          .send(pkg);

        assert(res.body.error, 'Token expired');
        assert.equal(res.status, 401);

      });

      it('should 403 when publish pkg no access', async () => {

        const name = '@enpm/new_pkg';
        const pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
        const res = await app.httpRequest()
          .put(`/${name}`)
          .set('authorization', `Bearer ${token.token}`)
          .set('user-agent', publisher.ua)
          .send(pkg);

        assert.equal(res.status, 403);
        assert.equal(res.body.error, `[FORBIDDEN] can't access package "${name}"`);

      });

      it('should 200 when token has no limit', async () => {
        token = await userService.createToken(user!.userId, {
          name: 'new-token',
          type: TokenType.granular,
          expires: 1,
        });

        const name = '@cnpm/new_pkg';
        const pkg = await TestUtil.getFullPackage({ name, version: '2.0.0' });
        const res = await app.httpRequest()
          .put(`/${name}`)
          .set('authorization', `Bearer ${token.token}`)
          .set('user-agent', publisher.ua)
          .send(pkg);

        assert.equal(res.status, 201);
      });

      it('should 200 when allowedScopes', async () => {
        token = await userService.createToken(user!.userId, {
          name: 'new-token',
          type: TokenType.granular,
          allowedScopes: [ '@cnpm' ],
          expires: 1,
        });

        const name = '@cnpm/new_pkg';
        const pkg = await TestUtil.getFullPackage({ name, version: '3.0.0' });
        const res = await app.httpRequest()
          .put(`/${name}`)
          .set('authorization', `Bearer ${token.token}`)
          .set('user-agent', publisher.ua)
          .send(pkg);

        assert.equal(res.status, 201);
      });

      it('should 200 when allowedPackages', async () => {
        await TestUtil.createPackage({ name: '@cnpm/other_new_pkg' }, { name: user!.name });
        token = await userService.createToken(user!.userId, {
          name: 'new-token',
          type: TokenType.granular,
          allowedPackages: [ '@cnpm/other_new_pkg' ],
          expires: 1,
        });

        const name = '@cnpm/other_new_pkg';
        const pkg = await TestUtil.getFullPackage({ name, version: '3.0.0' });
        const res = await app.httpRequest()
          .put(`/${name}`)
          .set('authorization', `Bearer ${token.token}`)
          .set('user-agent', publisher.ua)
          .send(pkg);

        assert.equal(res.status, 201);
      });
    });
  });
});
