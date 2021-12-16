import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { UserRepository } from '../../../../app/repository/UserRepository';

describe('test/port/controller/PackageController/saveVersion.test.ts', () => {
  let ctx: Context;
  let userRepository: UserRepository;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    userRepository = await ctx.getEggObject(UserRepository);
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[PUT /:fullname] saveVersion()', () => {
    it('should 403 when package is public', async () => {
      const { pkg, user } = await TestUtil.createPackage({ isPrivate: false, version: '1.0.0' });
      const pkg2 = await TestUtil.getFullPackage({ name: pkg.name, version: '2.0.0' });
      const res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', user.authorization)
        .set('user-agent', user.ua)
        .send(pkg2)
        .expect(403);
      assert.equal(res.body.error, `[FORBIDDEN] Can\'t modify npm public package "${pkg2.name}"`);
    });

    it('should add new version success on scoped package', async () => {
      const name = '@cnpm/publish-package-test';
      const pkg = await TestUtil.getFullPackage({ name, version: '0.0.0' });
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
      const pkg2 = await TestUtil.getFullPackage({ name, version: '1.0.0' });
      res = await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg2)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);

      const pkg3 = await TestUtil.getFullPackage({ name, version: '2.0.0' });
      res = await app.httpRequest()
        .put(`/${encodeURIComponent(pkg3.name)}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg3)
        .expect(201);
      assert.equal(res.body.ok, true);
      assert.match(res.body.rev, /^\d+\-\w{24}$/);
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

    it('should add new version without readme(object type) success', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/with-readme-object', version: '0.0.0' });
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
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/with-description-object', version: '0.0.0' });
      const version = Object.keys(pkg.versions)[0];
      pkg.versions[version].description = { foo: 'bar' };
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
      let pkg = await TestUtil.getFullPackage({
        name: 'excited!',
      });
      let res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain special characters ("~\'!()*")');

      pkg = await TestUtil.getFullPackage({
        name: ' leading-space:and:weirdchars',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can only contain URL-friendly characters');

      pkg = await TestUtil.getFullPackage({
        name: 'eLaBorAtE-paCkAgE-with-mixed-case-and-more-than-214-characters-----------------------------------------------------------------------------------------------------------------------------------------------------------',
      });
      res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] package.name invalid, errors: name can no longer contain more than 214 characters, name can no longer contain capital letters');
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
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');

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
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment.data format invalid');
    });

    it('should 422 when attachment size not match', async () => {
      const pkg = await TestUtil.getFullPackage({
        attachment: {
          length: 3,
        },
      });
      const res = await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] attachment size 3 not match download size 251');
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
        .send(pkg)
        .expect(422);
      assert.equal(res.body.error, '[UNPROCESSABLE_ENTITY] dist.shasum invalid');
    });

    it('should 422 when name not match pkg.name', async () => {
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
  });
});
