import path from 'path';
import { app, assert } from 'egg-mock/bootstrap';
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

  describe('npm install', () => {
    it('should support /@eggjs%2Ffoo router path', async () => {
      let res = await app.httpclient.request(`${registry}/@eggjs%2Ffoo`, { dataType: 'json' });
      assert.equal(res.status, 404);
      assert.equal(res.data.error, '[NOT_FOUND] @eggjs/foo not found');
      res = await app.httpclient.request(`${registry}/@eggjs%2fbar`, { dataType: 'json' });
      assert.equal(res.status, 404);
      assert.equal(res.data.error, '[NOT_FOUND] @eggjs/bar not found');

      res = await app.httpclient.request(`${registry}/@cnpm%2ffoo`, { dataType: 'json' });
      assert.equal(res.status, 200);
      assert.equal(res.data.name, '@cnpm/foo');
      res = await app.httpclient.request(`${registry}/@cnpm%2Ffoo`, { dataType: 'json' });
      assert.equal(res.status, 200);
      assert.equal(res.data.name, '@cnpm/foo');
    });

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
