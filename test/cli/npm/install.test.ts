import path from 'path';
import { app } from 'egg-mock/bootstrap';
import coffee from 'coffee';
import { TestUtil } from 'test/TestUtil';
import { npmLogin } from '../CliUtil';

describe('test/cli/npm/install.test.ts', () => {
  let server;
  let registry;
  let fooPkgDir;
  let demoDir;
  let userconfig;
  let cacheDir;
  before(done => {
    cacheDir = TestUtil.mkdtemp();
    fooPkgDir = TestUtil.getFixtures('@cnpm/foo');
    demoDir = TestUtil.getFixtures('demo');
    userconfig = path.join(fooPkgDir, '.npmrc');
    TestUtil.rm(userconfig);
    TestUtil.rm(path.join(demoDir, 'node_modules'));

    server = app.listen(0, () => {
      registry = `http://localhost:${server.address().port}`;
      console.log(`registry ${registry} ready`);
      done();
    });
  });

  after(() => {
    TestUtil.rm(userconfig);
    TestUtil.rm(cacheDir);
    TestUtil.rm(path.join(demoDir, 'node_modules'));
    server && server.close();
  });

  before(async () => {
    await npmLogin(registry, userconfig);
  });

  beforeEach(async () => {
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

  describe('npm install', () => {
    it('should work', async () => {
      await coffee
        .spawn('npm', [
          'view',
          '@cnpm/foo',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          // '--json',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /\/@cnpm\/foo\/\-\/foo-1.0.0.tgz/)
        .expect('code', 0)
        .end();
      await coffee
        .spawn('npm', [
          'install',
          '--package-lock=false',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          '--no-audit',
          // '--verbose',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /added 1 package/)
        .expect('code', 0)
        .end();
    });
  });
});
