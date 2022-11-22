import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { NFSClientAdapter } from 'app/infra/NFSClientAdapter';

describe('test/port/controller/package/DownloadPackageVersionTarController.test.ts', () => {
  let ctx: Context;
  let publisher: any;
  let nfsClientAdapter: NFSClientAdapter;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  const scopedName = '@cnpm/testmodule-download-version-tar';
  const name = 'testmodule-download-version-tar';
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
});
