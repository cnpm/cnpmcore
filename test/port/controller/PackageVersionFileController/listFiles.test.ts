import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil, type TestUser } from '../../../../test/TestUtil.ts';
import { PackageVersionFileService } from '../../../../app/core/service/PackageVersionFileService.ts';
import { calculateIntegrity } from '../../../../app/common/PackageUtil.ts';
import { DATABASE_TYPE, database } from '../../../../config/database.ts';

describe('test/port/controller/PackageVersionFileController/listFiles.test.ts', () => {
  let publisher: TestUser;
  let adminUser: TestUser;
  beforeEach(async () => {
    adminUser = await TestUtil.createAdmin();
    publisher = await TestUtil.createUser();
  });

  describe('[GET /:fullname/:versionSpec/files] listFiles()', () => {
    it('should 404 when enableUnpkg = false', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableUnpkg', false);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app
        .httpRequest()
        .get('/foo/1.0.0/files')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/package.json')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] Not Found');
    });

    it('should 404 when empty entry', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          main: '',
          description: 'empty main',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app
        .httpRequest()
        .get('/foo/1.0.0/files')
        .expect(302)
        .expect('location', '/foo/1.0.0/files/index.js');

      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/index.js')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(
        res.body.error,
        '[NOT_FOUND] File foo@1.0.0/index.js not found'
      );
    });

    it('should 422 when invalid spec', async () => {
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const res = await app
        .httpRequest()
        .get('/foo/@invalid-spec/files')
        .expect(422);

      assert.equal(
        res.body.error,
        '[INVALID_PARAM] must match format "semver-spec"'
      );
    });

    it('should list one package version files', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest().get('/foo/1.0.0').expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      const oldReadme = res.body.readme;
      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity:
              'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
      // not found README.md file, readme not change
      res = await app.httpRequest().get('/foo/1.0.0').expect(200);
      assert.equal(res.body.readme, oldReadme);

      // again should work
      res = await app
        .httpRequest()
        .get('/foo/1.0.0/files?meta')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      // console.log(res.body);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity:
              'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
    });

    it('should return the current directory files and directories instead all sub items', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const tarball = await TestUtil.readFixturesFile(
        'unpkg.com/openapi-7.3.3.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: 'openapi',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
        main: './lib/index.js',
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(res.status, 200);
      for (const file of res.body.files) {
        if (!file.lastModified) continue;
        file.lastModified = '2024-05-18T16:00:18.307Z';
      }
      // console.log(JSON.stringify(res.body, null, 2));
      if (database.type === DATABASE_TYPE.PostgreSQL) {
        assert.equal(res.body.files.length, 20);
      } else {
        assert.deepEqual(res.body, {
          path: '/',
          type: 'directory',
          files: [
            {
              path: '/LICENSE',
              type: 'file',
              contentType: 'text/plain',
              integrity:
                'sha512-OJCAthMtPqrngGSNaZg5DYzHGQhWG84JV44nxUKqGp8xIuAfZAxbAb7nMATCOqTp8gZv5e4MogcsJCBXiyjXHw==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 11_357,
            },
            {
              path: '/index.html',
              type: 'file',
              contentType: 'text/plain',
              integrity:
                'sha512-L4Vxx8DW1PtZfPut4uwP9DSK9+DbFbKDWWGp4KK5TRKGTHSjYoMExqY50WiTKs/bGu1Ecpneiu3dnYlRZ/sDdw==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 1437,
            },
            {
              path: '/package.json',
              type: 'file',
              contentType: 'application/json',
              integrity:
                'sha512-ke5ybpErJgl+Mul1XCSMvly0uYAt8/5mWa5/yYykxfMCE0OBpzgWoFHC+/RM9AQfNgic3bW/ssHXDUUPZiEKkg==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 2852,
            },
            {
              path: '/CHANGES.md',
              type: 'file',
              contentType: 'text/markdown',
              integrity:
                'sha512-xxD+0Mdep4Pprq0JsudGLCKtSfHBeIqJVoGqM0qK1b2B/0sXjSQYinxgAwjK8rKSD0jNSo3R5aK8VbgOXLtbjw==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 12_346,
            },
            {
              path: '/README.md',
              type: 'file',
              contentType: 'text/markdown',
              integrity:
                'sha512-Nnj8b9SsDDobga1LsV7FVE46YrxkdZf5MOMboVHICw56tPHnQ0v1lXvXkWz7k12kTFWbA0z42daaW7WE+AQWfw==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 4409,
            },
            {
              path: '/.npmcheckrc.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-EYTJJ5StGM9DUpAbF8XHV4Z02rlmzN9O6k93fu1YXpf1wDBtmFYG64xaTXk2UfB8x0BCotga+Upm1yOgJVIZTQ==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 105,
            },
            {
              path: '/.redocly.lint-ignore.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-tyPeiIaOGIXb3PNFb2ELAZawxGHSdPZ7IoLdl+tEcDARVFlq6B9yJVAzL5R8L26iCBbvPtlfNGnYkHj4H/5ZMA==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 644,
            },
            {
              path: '/index.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-KW7xaZW5F8NOGt72kc9WvLcvkFDmXbm65JdWPM2pYfy9HMX0/6obJD5jhzQSX5ZU8ww0HMlXGXkRviFnDr88ZA==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 21_379,
            },
            {
              path: '/.eslintrc.yml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-3q0aghG4dBd7pgE4UrbtVn52cfg3BqOPkuNcCSwHZKMSFnKZxWr+sH7/OgnBDaifVsXGK7AN8q7sX0Eds6Ditw==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 149,
            },
            {
              path: '/oauth2',
              type: 'directory',
              files: [],
            },
            {
              path: '/_util',
              type: 'directory',
              files: [],
            },
            {
              path: '/resource',
              type: 'directory',
              files: [],
            },
            {
              path: '/parameters',
              type: 'directory',
              files: [],
            },
            {
              path: '/id',
              type: 'directory',
              files: [],
            },
            {
              path: '/location',
              type: 'directory',
              files: [],
            },
            {
              path: '/string',
              type: 'directory',
              files: [],
            },
            {
              path: '/money',
              type: 'directory',
              files: [],
            },
            {
              path: '/time',
              type: 'directory',
              files: [],
            },
            {
              path: '/human',
              type: 'directory',
              files: [],
            },
            {
              path: '/health',
              type: 'directory',
              files: [],
            },
          ],
        });
      }

      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/id/?meta`);
      assert.equal(res.status, 200);
      for (const file of res.body.files) {
        if (!file.lastModified) continue;
        file.lastModified = '2024-05-18T16:00:18.307Z';
      }
      // console.log(JSON.stringify(res.body, null, 2));
      if (database.type === DATABASE_TYPE.PostgreSQL) {
        assert.equal(res.body.files.length, 10);
      } else {
        assert.deepEqual(res.body, {
          path: '/id',
          type: 'directory',
          files: [
            {
              path: '/id/AccountId.d.ts',
              type: 'file',
              contentType: 'text/plain',
              integrity:
                'sha512-xj1/RCRAp72pukals97C98DG0b38Gl2xNrUwOi2SRj+EnJKIfQX8WisDpCOSKLFq5j++sGbL0/4wCttrPvi37w==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 787,
            },
            {
              path: '/id/AccountId.js',
              type: 'file',
              contentType: 'application/javascript',
              integrity:
                'sha512-kFa+SXSMGbCh2DiuSGmlCS8OCBSE4VRGlq/A2IyY3QxL794soFq4zO3F+UEx4ANUG33urAa4LG4IY2OiUc2Mng==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 1343,
            },
            {
              path: '/id/AccountId.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-R6WB9dXEaNpvqIAH6OdRQ77gSEBlq1GeH2jv2tv1wQEVOmzQtErHlpj+ukvZUwzqf9wTXIPxKjeUhqk6VbfBkA==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 571,
            },
            {
              path: '/id/Mode.js',
              type: 'file',
              contentType: 'application/javascript',
              integrity:
                'sha512-jfMuIff4LW/ZQ8el9iCww8c9gw+12UK7eZn+6TMDAlStfLhlu8u7jcCSWSEG1zBTty9DIHn4Nbp+dMDjRUnVWQ==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 3357,
            },
            {
              path: '/id/mode.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-er9S1Da52G8fxwfgxhNbcXPdYz9bzABM7VifDXhgVGX+hwtu8tve9y2aZhPAHcJOy3dClMDQ1eYLAHp7k8TMNQ==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 1222,
            },
            {
              path: '/id/UUID.js',
              type: 'file',
              contentType: 'application/javascript',
              integrity:
                'sha512-bo/JyxOZeRRjbN0OR8vNRz3cTY2GcJfRmRnp3QTGXE5iuKYjrpjYzj+vEXopZV1QYPdZaXUK671EoysPE59pQQ==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 992,
            },
            {
              path: '/id/UUID.yaml',
              type: 'file',
              contentType: 'text/yaml',
              integrity:
                'sha512-Gjr0LNqWQcO5/oaCyMm9oZWpc/D9K6Qe37sGuYv4kbq0I8teZL92xbR81L+2VShkhLSXdg2Qw5WRjwCkSWyfoA==',
              lastModified: '2024-05-18T16:00:18.307Z',
              size: 659,
            },
            {
              path: '/id/legalPerson',
              type: 'directory',
              files: [],
            },
            {
              path: '/id/naturalPerson',
              type: 'directory',
              files: [],
            },
            {
              path: '/id/sigedis',
              type: 'directory',
              files: [],
            },
          ],
        });
      }

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/id/legalPerson/?meta`);
      assert.equal(res.status, 200);
      // console.log(JSON.stringify(res.body, null, 2));
      assert.deepEqual(res.body, {
        path: '/id/legalPerson',
        type: 'directory',
        files: [
          {
            path: '/id/legalPerson/be',
            type: 'directory',
            files: [],
          },
        ],
      });

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/id/legalPerson/be/?meta`);
      assert.equal(res.status, 200);
      for (const file of res.body.files) {
        if (!file.lastModified) continue;
        file.lastModified = '2024-05-18T16:00:18.307Z';
      }
      // console.log(JSON.stringify(res.body, null, 2));
      assert.deepEqual(res.body, {
        path: '/id/legalPerson/be',
        type: 'directory',
        files: [
          {
            path: '/id/legalPerson/be/CRN.js',
            type: 'file',
            contentType: 'application/javascript',
            integrity:
              'sha512-K7fRjnkAkNnSYbWZW4A+xcdYbI2J1fk49AxFVut2Kk6LXOZbLH6nU9CFeo0YixDLa1Hl5sjLiUQ7Mur2HQgvNw==',
            lastModified: '2024-05-18T16:00:18.307Z',
            size: 3285,
          },
          {
            path: '/id/legalPerson/be/CRN.yaml',
            type: 'file',
            contentType: 'text/yaml',
            integrity:
              'sha512-pG12081uMexKHGfmetjZ5p6sB1z+Y/StRyRC1BOW/CGcuLW8iDdY848C6gS9qEXq0DAQwIg9jv18uf4uP1lOwg==',
            lastModified: '2024-05-18T16:00:18.307Z',
            size: 2793,
          },
          {
            path: '/id/legalPerson/be/KBO.yaml',
            type: 'file',
            contentType: 'text/yaml',
            integrity:
              'sha512-8s8lUEsYAJfPw1ar9l6fUxOapU1q5GzuhsprQrOmsGRbDNildPvzdO5KPVXQdoz4aHxMkOIxaVDDQl1NB1OPAA==',
            lastModified: '2024-05-18T16:00:18.307Z',
            size: 700,
          },
        ],
      });
    });

    it('should latest tag with scoped package', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
      });
      let res = await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg);
      assert.equal(res.status, 201);
      res = await app.httpRequest().get(`/${pkg.name}/latest`).expect(200);
      const publishTime = new Date(res.body.publish_time).toISOString();
      res = await app.httpRequest().get(`/${pkg.name}/latest/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest().get(`/${pkg.name}/^1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest().get(`/${pkg.name}/%5E1.0.0/files`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/latest/files?meta&foo=bar`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.location,
        `/${pkg.name}/1.0.0/files?meta&foo=bar`
      );
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest().get(`/${pkg.name}/latest/files/`);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/${pkg.name}/1.0.0/files/`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files?meta=1`);
      assert.equal(res.status, 200);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity:
              'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
      res = await app.httpRequest().get(`/${pkg.name}/1.0.0/files/`);
      assert.equal(
        res.headers['cache-control'],
        'public, s-maxage=600, max-age=60'
      );
      assert.equal(res.headers.vary, 'Origin, Accept, Accept-Encoding');
      assert.deepEqual(res.body, {
        path: '/',
        type: 'directory',
        files: [
          {
            path: '/package.json',
            type: 'file',
            contentType: 'application/json',
            integrity:
              'sha512-yTg/L7tUtFK54aNH3iwgIp7sF3PiAcUrIEUo06bSNq3haIKRnagy6qOwxiEmtfAtNarbjmEpl31ZymySsECi3Q==',
            lastModified: publishTime,
            size: 209,
          },
        ],
      });
    });

    it('should list sub dir files not found', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app
        .httpRequest()
        .get('/foo/1.0.0/files/foo/')
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.error, '[NOT_FOUND] foo@1.0.0/files/foo not found');
    });

    it('should auto sync after version publish', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/unittest-unpkg-demo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/package.json`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
    });

    it('should 451 when package block', async () => {
      const { pkg } = await TestUtil.createPackage({ isPrivate: false });
      let res = await app
        .httpRequest()
        .put(`/-/package/${pkg.name}/blocks`)
        .set('authorization', adminUser.authorization)
        .send({
          reason: 'only for tests again',
        });
      assert.equal(res.status, 201);
      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/foo/`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(
        res.body.error,
        /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/
      );

      res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files`)
        .expect(451)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.match(
        res.body.error,
        /\[UNAVAILABLE_FOR_LEGAL_REASONS] @cnpm\/testmodule@1.0.0 was blocked, reason: only for tests again/
      );
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      const res = await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.40000404/files`)
        .expect(404);
      assert.ok(!res.headers.etag);
      assert.ok(!res.headers['cache-control']);
      assert.equal(
        res.body.error,
        `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`
      );
    });

    it('should 404 when package not exists', async () => {
      const res = await app
        .httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404/files')
        .expect(404);
      assert.ok(!res.headers.etag);
      assert.ok(!res.headers['cache-control']);
      assert.equal(
        res.body.error,
        '[NOT_FOUND] @cnpm/foonot-exists@1.0.40000404 not found'
      );
    });

    it('should conflict when syncing', async () => {
      mock(app.config.cnpmcore, 'enableUnpkg', true);
      const { pkg } = await TestUtil.createPackage({
        name: '@cnpm/banana',
        version: '1.0.0',
        versionObject: {
          description: 'mock mock',
        },
      });
      let called = 0;
      mock(
        PackageVersionFileService.prototype,
        'syncPackageVersionFiles',
        async () => {
          called++;
          await setTimeout(50);
        }
      );
      const resList = await Promise.all(
        [0, 1].map(() => app.httpRequest().get(`/${pkg.name}/1.0.0/files/`))
      );
      assert.equal(called, 1);
      assert.equal(
        resList.filter(
          res =>
            res.status === 409 &&
            res.body.error ===
              '[CONFLICT] Package version file sync is currently in progress. Please try again later.'
        ).length,
        1
      );
    });

    it('should redirect to possible entry', async () => {
      const tarball = await TestUtil.readFixturesFile(
        '@cnpm/cnpm-test-find-entry-1.0.0.tgz'
      );
      const { integrity } = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/test-find-entry',
        version: '1.0.0',
        versionObject: {
          description: 'test find entry description',
        },
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: {
          integrity,
        },
      });

      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/es/array/at`)
        .expect(302)
        .expect('location', `/${pkg.name}/1.0.0/files/es/array/at.js`);

      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/es/array`)
        .expect(302)
        .expect('location', `/${pkg.name}/1.0.0/files/es/array/index.js`);

      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/es/json/test`)
        .expect(302)
        .expect('location', `/${pkg.name}/1.0.0/files/es/json/test.json`);

      await app
        .httpRequest()
        .get(`/${pkg.name}/1.0.0/files/es/json`)
        .expect(302)
        .expect('location', `/${pkg.name}/1.0.0/files/es/json/index.json`);
    });

    describe('enableSyncUnpkgFilesWhiteList = true', () => {
      it('should 403 package name not in white list', async () => {
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
        mock(app.config.cnpmcore, 'enableUnpkg', true);
        mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);

        const pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '1.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        const res = await app
          .httpRequest()
          .get('/foo/1.0.0/files/index.js')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 403);
        assert.equal(
          res.body.error,
          '[FORBIDDEN] "foo" is not allow to unpkg files, see https://github.com/cnpm/unpkg-white-list'
        );
      });

      it('should 403 package version not match', async () => {
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
        mock(app.config.cnpmcore, 'enableUnpkg', true);
        mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);

        let pkg = await TestUtil.getFullPackage({
          name: 'unpkg-white-list',
          version: '0.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            allowPackages: {
              foo: {
                version: '0.0.0',
              },
            },
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '1.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        const res = await app
          .httpRequest()
          .get('/foo/1.0.0/files/index.js')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 403);
        assert.equal(
          res.body.error,
          '[FORBIDDEN] "foo@1.0.0" not satisfies "0.0.0" to unpkg files, see https://github.com/cnpm/unpkg-white-list'
        );
      });

      it('should 200 when scope in white list', async () => {
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
        mock(app.config.cnpmcore, 'enableUnpkg', true);
        mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);

        let pkg = await TestUtil.getFullPackage({
          name: 'unpkg-white-list',
          version: '1.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            allowScopes: ['@cnpm'],
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        pkg = await TestUtil.getFullPackage({
          name: '@cnpm/foo',
          version: '1.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        const res = await app
          .httpRequest()
          .get('/@cnpm/foo/1.0.0/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);
      });

      it('should 200 when package version in white list', async () => {
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
        mock(app.config.cnpmcore, 'enableUnpkg', true);
        mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);

        let pkg = await TestUtil.getFullPackage({
          name: 'unpkg-white-list',
          version: '2.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            allowScopes: ['@cnpm'],
            allowPackages: {
              foo: {
                version: '*',
              },
            },
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '1.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);

        let res = await app
          .httpRequest()
          .get('/foo/1.0.0/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);

        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '1.0.1',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        res = await app
          .httpRequest()
          .get('/foo/1.0.1/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);

        // unpkg-white-list change
        pkg = await TestUtil.getFullPackage({
          name: 'unpkg-white-list',
          version: '2.0.1',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            allowScopes: ['@cnpm'],
            allowPackages: {
              foo: {
                version: '3',
              },
            },
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '1.0.2',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);

        res = await app
          .httpRequest()
          .get('/foo/1.0.2/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 403);
        assert.equal(
          res.body.error,
          '[FORBIDDEN] "foo@1.0.2" not satisfies "3" to unpkg files, see https://github.com/cnpm/unpkg-white-list'
        );
      });

      it('bugfix: should support rc version', async () => {
        // https://github.com/cnpm/unpkg-white-list/issues/63
        mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
        mock(app.config.cnpmcore, 'enableUnpkg', true);
        mock(app.config.cnpmcore, 'enableSyncUnpkgFilesWhiteList', true);

        let pkg = await TestUtil.getFullPackage({
          name: 'unpkg-white-list',
          version: '2.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
            allowScopes: ['@cnpm'],
            allowPackages: {
              foo: {
                version: '*',
              },
              bar: {
                version: '1.0.0',
              },
              baz: {
                version: '*',
              },
            },
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '0.0.0',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);

        let res = await app
          .httpRequest()
          .get('/foo/0.0.0/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);

        pkg = await TestUtil.getFullPackage({
          name: 'foo',
          version: '0.3.0-rc15',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        res = await app
          .httpRequest()
          .get('/foo/0.3.0-rc15/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);

        pkg = await TestUtil.getFullPackage({
          name: 'baz',
          version: '0.3.0-rc15',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        res = await app
          .httpRequest()
          .get('/baz/0.3.0-rc15/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 200);
        assert.ok(res.body.name);

        pkg = await TestUtil.getFullPackage({
          name: 'bar',
          version: '0.3.0-rc15',
          versionObject: {
            description:
              'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
          },
        });
        await app
          .httpRequest()
          .put(`/${pkg.name}`)
          .set('authorization', publisher.authorization)
          .set('user-agent', publisher.ua)
          .send(pkg)
          .expect(201);
        res = await app
          .httpRequest()
          .get('/bar/0.3.0-rc15/files/package.json')
          .expect('content-type', 'application/json; charset=utf-8');
        assert.equal(res.status, 403);
        assert.equal(
          res.body.error,
          '[FORBIDDEN] "bar@0.3.0-rc15" not satisfies "1.0.0" to unpkg files, see https://github.com/cnpm/unpkg-white-list'
        );
      });
    });
  });
});
