import assert from 'assert';
import path from 'path';
import { app } from 'egg-mock/bootstrap';
import coffee from 'coffee';
import { TestUtil } from '../../../test/TestUtil';
import { npmLogin } from '../CliUtil';

describe('test/cli/npm/install.test.ts', () => {
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
    await TestUtil.rm(userconfig);
    await TestUtil.rm(path.join(demoDir, 'node_modules'));

    await new Promise(resolve => {
      server = app.listen(0, () => {
        registry = `http://localhost:${server.address().port}`;
        console.log(`registry ${registry} ready`);
        resolve(void 0);
      });
    });
  });

  after(async () => {
    await TestUtil.rm(userconfig);
    await TestUtil.rm(cacheDir);
    await TestUtil.rm(path.join(demoDir, 'node_modules'));
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
    await coffee
      .spawn('npm', [
        'publish',
        `--registry=${registry}`,
        `--userconfig=${userconfig}`,
        `--cache=${cacheDir}`,
      ], {
        cwd: TestUtil.getFixtures('@cnpm/foo-2.0.0'),
      })
      .debug()
      .expect('code', 0)
      .end();
  });

  describe('npm install', () => {
    it('should support /@cnpm%2Ffoo1 router path', async () => {
      let res = await app.httpclient.request(`${registry}/@cnpm%2Ffoo1`, { dataType: 'json' });
      assert.equal(res.status, 404);
      assert.equal(res.data.error, '[NOT_FOUND] @cnpm/foo1 not found');
      res = await app.httpclient.request(`${registry}/@cnpm%2fbar`, { dataType: 'json' });
      assert.equal(res.status, 404);
      assert.equal(res.data.error, '[NOT_FOUND] @cnpm/bar not found');

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
        .expect('stdout', /\/@cnpm\/foo\/\-\/foo-2.0.0.tgz/)
        .expect('code', 0)
        .end();

      await coffee
        .spawn('npm', [
          'dist-tag',
          'ls',
          '@cnpm/foo',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          // '--json',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /latest: 2\.0\.0/)
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
        .expect('code', 0)
        .end();

      await coffee
        .spawn('npm', [
          'unpublish',
          '-f',
          '@cnpm/foo@1.0.0',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          '--verbose',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /\- \@cnpm\/foo/)
        .expect('code', 0)
        .end();
      await coffee
        .spawn('npm', [
          'unpublish',
          '-f',
          '@cnpm/foo@2.0.0',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
          '--verbose',
        ], {
          cwd: demoDir,
        })
        .debug()
        .expect('stdout', /\- \@cnpm\/foo/)
        .expect('code', 0)
        .end();
      const res = await app.httpclient.request(`${registry}/@cnpm%2ffoo`, { dataType: 'json' });
      assert.equal(res.status, 200);
      assert(res.data.time.unpublished);
      assert.equal(res.data.versions, undefined);
    });
  });
});
