// import assert from 'assert';
import path from 'path';
import { app } from 'egg-mock/bootstrap';
import coffee from 'coffee';
import { TestUtil } from 'test/TestUtil';
import { npmLogin } from '../CliUtil';

describe('test/cli/npm/access.test.ts', () => {
  let server;
  let registry;
  let fooPkgDir;
  let demoDir;
  let userconfig;
  let cacheDir;
  before(async () => {
    cacheDir = TestUtil.mkdtemp();
    fooPkgDir = TestUtil.getFixtures('@cnpm/foo');
    demoDir = TestUtil.getFixtures('demo');
    userconfig = path.join(fooPkgDir, '.npmrc');
    TestUtil.rm(userconfig);
    TestUtil.rm(path.join(demoDir, 'node_modules'));

    return new Promise(resolve => {
      server = app.listen(0, () => {
        registry = `http://localhost:${server.address().port}`;
        console.log(`registry ${registry} ready`);
        resolve();
      });
    });
  });

  after(() => {
    TestUtil.rm(userconfig);
    TestUtil.rm(cacheDir);
    TestUtil.rm(path.join(demoDir, 'node_modules'));
    server && server.close();
  });

  beforeEach(async () => {
    await npmLogin(registry, userconfig);
    await coffee
      .spawn('npm', [
        'publish',
        `--registry=${registry}`,
        `--userconfig=${userconfig}`,
        `--cache=${cacheDir}`,
      ], {
        cwd: fooPkgDir,
      })
      .debug()
      .expect('code', 0)
      .end();
  });

  describe('npm access', () => {

    it('should work for list collaborators', async () => {
      await coffee
        .spawn('npm', [
          'access',
          'list',
          'collaborators',
          '@cnpm/foo',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          // '--json',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /testuser: read-write/)
        .expect('code', 0)
        .end();

    });

    it('should work for list all packages', async () => {
      await coffee
        .spawn('npm', [
          'access',
          'list',
          'packages',
          'testuser',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          // '--json',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /@cnpm\/foo: read-write/)
        .expect('code', 0)
        .end();

    });

    it('should work for list single package', async () => {
      await coffee
        .spawn('npm', [
          'access',
          'list',
          'packages',
          'testuser',
          '@cnpm/foo',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          // '--json',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /@cnpm\/foo: read-write/)
        .expect('code', 0)
        .end();

    });
  });
});
