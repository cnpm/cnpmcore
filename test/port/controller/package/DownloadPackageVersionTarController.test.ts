import { strict as assert } from 'assert';
import { setTimeout } from 'node:timers/promises';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { NFSClientAdapter } from '../../../../app/infra/NFSClientAdapter';
import { SyncMode } from '../../../../app/common/constants';

describe('test/port/controller/package/DownloadPackageVersionTarController.test.ts', () => {
  let publisher: any;
  let nfsClientAdapter: NFSClientAdapter;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
  });

  const scope = '@cnpm';
  const name = 'testmodule-download-version-tar';
  const scopedName = `${scope}/${name}`;
  beforeEach(async () => {
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    let pkg = await TestUtil.getFullPackage({ name, version: '1.0.0' });
    let res = await app.httpRequest()
      .put(`/${pkg.name}`)
      .set('authorization', publisher.authorization)
      .set('user-agent', publisher.ua)
      .send(pkg)
      .expect(201);
    assert(res.status === 201);
    assert(res.body.ok === true);
    assert.match(res.body.rev, /^\d+\-\w{24}$/);

    pkg = await TestUtil.getFullPackage({ name: scopedName, version: '1.0.0' });
    res = await app.httpRequest()
      .put(`/${pkg.name}`)
      .set('authorization', publisher.authorization)
      .set('user-agent', publisher.ua)
      .send(pkg);
    assert(res.status === 201);
    assert(res.body.ok === true);
    assert.match(res.body.rev, /^\d+\-\w{24}$/);
  });

  describe('[GET /:fullname/-/:name-:version.tgz] download()', () => {
    it('should download a version tar redirect to mock cdn success', async () => {
      mock(nfsClientAdapter, 'url', async (storeKey: string) => {
        return `https://cdn.mock.com${storeKey}`;
      });

      let res = await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${name}/1.0.0/${name}-1.0.0.tgz`);
      res = await app.httpRequest()
        .get(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${scopedName}/1.0.0/${name}-1.0.0.tgz`);
    });

    it('should support cors OPTIONS Request', async () => {
      mock(nfsClientAdapter, 'url', async (storeKey: string) => {
        return `https://cdn.mock.com${storeKey}`;
      });

      let res = await app.httpRequest()
        .options(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`);
      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], '*');
      assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD');
      res = await app.httpRequest()
        .options(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`);
      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], '*');
      assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD');
    });

    if (process.env.CNPMCORE_NFS_TYPE !== 'oss') {
      it('should download a version tar redirect to mock cdn success with url function is not async function', async () => {
        mock(nfsClientAdapter, 'url', (storeKey: string) => {
          return `https://cdn.mock.com${storeKey}`;
        });

        let res = await app.httpRequest()
          .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`);
        assert(res.status === 302);
        assert(res.headers.location === `https://cdn.mock.com/packages/${name}/1.0.0/${name}-1.0.0.tgz`);
        res = await app.httpRequest()
          .get(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`);
        assert(res.status === 302);
        assert(res.headers.location === `https://cdn.mock.com/packages/${scopedName}/1.0.0/${name}-1.0.0.tgz`);
      });
    }

    it('should download a version tar with streaming success', async () => {
      mock(nfsClientAdapter, 'url', 'not-function');
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar-1.0.0.tgz"')
        .expect(200);

      await app.httpRequest()
        .get(`/${scopedName}/-/testmodule-download-version-tar-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar-1.0.0.tgz"')
        .expect(200);
    });

    it('should download non-scope package tar success', async () => {
      mock(nfsClientAdapter, 'url', 'not-function');
      const pkg = await TestUtil.getFullPackage({ name: 'testmodule-download-version-tar222', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      await app.httpRequest()
        .get(`/${pkg.name}/-/${pkg.name}-1.0.0.tgz`)
        .expect('content-type', 'application/octet-stream')
        .expect('content-disposition', 'attachment; filename="testmodule-download-version-tar222-1.0.0.tgz"')
        .expect(200);
    });

    it('should mock getDownloadUrlOrStream return undefined', async () => {
      const pkg = await TestUtil.getFullPackage({ name: 'testmodule-download-version-tar222', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      mock(nfsClientAdapter, 'createDownloadStream', async () => {
        return undefined;
      });
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }
      const res = await app.httpRequest()
        .get(`/${pkg.name}/-/${pkg.name}-1.0.0.tgz`);
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      assert(res.body.error === '[NOT_FOUND] "testmodule-download-version-tar222-1.0.0.tgz" not found');
    });

    it('should 422 when version is empty string', async () => {
      await app.httpRequest()
        .get(`/${name}/-/testmodule-download-version-tar-.tgz`)
        .expect(422)
        .expect({
          error: '[INVALID_PARAM] version: must NOT have fewer than 5 characters',
        });
    });

    it('should 404 when package not exists', async () => {
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }
      await app.httpRequest()
        .get('/@cnpm/testmodule-download-version-tar-not-exists/-/testmodule-download-version-tar-not-exists-1.0.0.tgz')
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar-not-exists not found',
        });

      const res = await app.httpRequest()
        .get('/testmodule-download-version-tar-not-exists/-/testmodule-download-version-tar-not-exists-1.0.0.tgz');
      assert(res.status === 302);
      assert(res.headers.location === 'https://registry.npmjs.org/testmodule-download-version-tar-not-exists/-/testmodule-download-version-tar-not-exists-1.0.0.tgz');
    });

    it('should 404 when package version not exists', async () => {
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }

      await app.httpRequest()
        .get(`/${name}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] testmodule-download-version-tar@1.0.404404 not found',
        });

      await app.httpRequest()
        .get(`/${scopedName}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar@1.0.404404 not found',
        });
    });

    it('should redirect to source registry when package version not exists', async () => {
      mock(nfsClientAdapter, 'url', async () => {
        return 'http://foo.com/foo.tgz';
      });

      await app.httpRequest()
        .get(`/${name}/-/${name}-1.0.404404.tgz`)
        .expect(302)
        .expect('location', `https://registry.npmjs.org/${name}/-/${name}-1.0.404404.tgz`);

      // not redirect the private package
      await app.httpRequest()
        .get(`/${scopedName}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: `[NOT_FOUND] ${scopedName}@1.0.404404 not found`,
        });
    });

    it('should not redirect public package to source registry when syncMode=all', async () => {
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }

      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/foo/-/foo-1.0.404404.tgz');
      assert(res.status === 404);
      assert(res.body.error === '[NOT_FOUND] foo not found');

      // not redirect when package exists
      await app.httpRequest()
        .get(`/${name}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] testmodule-download-version-tar@1.0.404404 not found',
        });
      await app.httpRequest()
        .get(`/${scopedName}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar@1.0.404404 not found',
        });
    });

    it('should redirect public package to source registry when syncMode=none', async () => {
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }

      mock(app.config.cnpmcore, 'syncMode', 'none');
      await app.httpRequest()
        .get('/foo/-/foo-1.0.404404.tgz')
        .expect(302)
        .expect('location', 'https://registry.npmjs.org/foo/-/foo-1.0.404404.tgz');

      await app.httpRequest()
        .get('/foo/-/foo-1.0.404404.tgz?t=123')
        .expect(302)
        .expect('location', 'https://registry.npmjs.org/foo/-/foo-1.0.404404.tgz?t=123');

      mock(app.config.cnpmcore, 'redirectNotFound', false);
      // not redirect when package exists
      await app.httpRequest()
        .get(`/${name}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] testmodule-download-version-tar@1.0.404404 not found',
        });
      await app.httpRequest()
        .get(`/${scopedName}/-/${name}-1.0.404404.tgz`)
        .expect(404)
        .expect({
          error: '[NOT_FOUND] @cnpm/testmodule-download-version-tar@1.0.404404 not found',
        });
    });

    it('should not create sync task when package version tgz not exists and syncNotFound=false', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      mock(app.config.cnpmcore, 'syncNotFound', false);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app.httpRequest()
        .get('/lodash/-/lodash-1.404.404.tgz')
        .set('user-agent', publisher.ua + ' node/16.0.0')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 404);
      app.notExpectLog('[middleware:ErrorHandler][syncPackage] create sync package');
    });

    it('should create sync task when package version tgz not exists and syncNotFound=true', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'exist');
      mock(app.config.cnpmcore, 'syncNotFound', true);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app.httpRequest()
        .get('/lodash/-/lodash-1.404.404.tgz')
        .set('user-agent', publisher.ua + ' node/16.0.0')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 404);
      app.expectLog('[middleware:ErrorHandler][syncPackage] create sync package');
    });

    it('should create sync specific version task when package version tgz not found in proxy mode ', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const res = await app.httpRequest()
        .get('/foobar/-/foobar-1.0.0.tgz')
        .set('user-agent', publisher.ua + ' node/16.0.0')
        .set('Accept', 'application/vnd.npm.install-v1+json');
      assert(res.status === 200);
      // run in background
      await setTimeout(500);
      app.expectLog('[DownloadPackageVersionTarController.createSyncTask:success]');
    });

  });

  describe('[GET /:fullname/download/:fullname-:version.tgz] deprecatedDownload()', () => {
    it('should download a version tar redirect to mock cdn success', async () => {
      mock(nfsClientAdapter, 'url', async (storeKey: string) => {
        // console.log('call url: ', storeKey);
        return `https://cdn.mock.com${storeKey}`;
      });
      let res = await app.httpRequest()
        .get(`/${name}/download/${name}-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${name}/1.0.0/${name}-1.0.0.tgz`);
      res = await app.httpRequest()
        .get(`/${scopedName}/download/${scopedName}-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${scopedName}/1.0.0/${name}-1.0.0.tgz`);
    });

    it('should download a version tar with streaming success', async () => {
      mock(nfsClientAdapter, 'url', 'not-function');
      const res = await app.httpRequest()
        .get(`/${name}/download/${name}-1.0.0.tgz`);
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/octet-stream');
      assert(res.headers['content-disposition'] === `attachment; filename="${name}-1.0.0.tgz"`);

      await app.httpRequest()
        .get(`/${scopedName}/download/${scopedName}-1.0.0.tgz`);
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/octet-stream');
      assert(res.headers['content-disposition'] === `attachment; filename="${name}-1.0.0.tgz"`);
    });

    it('should mock getDownloadUrlOrStream return undefined', async () => {
      mock(nfsClientAdapter, 'createDownloadStream', async () => {
        return undefined;
      });
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }
      const res = await app.httpRequest()
        .get(`/${name}/download/${name}-1.0.0.tgz`);
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      assert(res.body.error === `[NOT_FOUND] "${name}-1.0.0.tgz" not found`);
    });
  });

  describe('[GET /:fullname/-/:scope/:name-:version.tgz] download()', () => {
    it('should download a version tar redirect to mock cdn success', async () => {
      mock(nfsClientAdapter, 'url', async (storeKey: string) => {
        // console.log('call url: ', storeKey);
        return `https://cdn.mock.com${storeKey}`;
      });
      let res = await app.httpRequest()
        .get(`/${name}/-/${scope}/${name}-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${name}/1.0.0/${name}-1.0.0.tgz`);
      res = await app.httpRequest()
        .get(`/${scopedName}/-/${scope}/${name}-1.0.0.tgz`);
      assert(res.status === 302);
      assert(res.headers.location === `https://cdn.mock.com/packages/${scopedName}/1.0.0/${name}-1.0.0.tgz`);
    });

    it('should download a version tar with streaming success', async () => {
      mock(nfsClientAdapter, 'url', 'not-function');
      const res = await app.httpRequest()
        .get(`/${name}/-/${scope}/${name}-1.0.0.tgz`);
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/octet-stream');
      assert(res.headers['content-disposition'] === `attachment; filename="${name}-1.0.0.tgz"`);

      await app.httpRequest()
        .get(`/${scopedName}/-/${scope}/${name}-1.0.0.tgz`);
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/octet-stream');
      assert(res.headers['content-disposition'] === `attachment; filename="${name}-1.0.0.tgz"`);
    });

    it('should mock getDownloadUrlOrStream return undefined', async () => {
      mock(nfsClientAdapter, 'createDownloadStream', async () => {
        return undefined;
      });
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
        mock(nfsClientAdapter, 'url', async () => {
          return undefined;
        });
      }
      const res = await app.httpRequest()
        .get(`/${name}/-/${scope}/${name}-1.0.0.tgz`);
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      assert(res.body.error === `[NOT_FOUND] "${name}-1.0.0.tgz" not found`);
    });
  });
});
