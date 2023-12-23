import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../TestUtil';
import { ProxyCacheService } from '../../../app/core/service/ProxyCacheService';
import { ProxyCacheRepository } from '../../../app/repository/ProxyCacheRepository';
import { DIST_NAMES } from '../../../app/core/entity/Package';
import { PROXY_CACHE_DIR_NAME } from '../../../app/common/constants';
import { NPMRegistry } from '../../../app/common/adapter/NPMRegistry';
import { NFSAdapter } from '../../../app/common/adapter/NFSAdapter';
import { ProxyCache } from '../../../app/core/entity/ProxyCache';
import { TaskService } from '../../../app/core/service/TaskService';

describe('test/core/service/ProxyCacheService/index.test.ts', () => {
  let proxyCacheService: ProxyCacheService;
  let npmRegistry: NPMRegistry;
  let proxyCacheRepository: ProxyCacheRepository;

  beforeEach(async () => {
    proxyCacheService = await app.getEggObject(ProxyCacheService);
    npmRegistry = await app.getEggObject(NPMRegistry);
    proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
  });

  describe('getPackageVersionTarBuffer()', () => {
    it('should get tgz buffer from source', async () => {
      const data = await TestUtil.readFixturesFile(
        'registry.npmjs.org/foobar/-/foobar-1.0.0.tgz',
      );
      app.mockHttpclient(
        'https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz',
        'GET',
        {
          data,
          persist: false,
        },
      );
      const buffer = await proxyCacheService.getPackageVersionTarBuffer(
        'foobar',
        'foobar/-/foobar-1.0.0.tgz',
      );
      assert.equal(data.byteLength, buffer?.byteLength);
    });

    it('should block package in block list', async () => {
      mock(app.config.cnpmcore, 'syncPackageBlockList', [ 'bar' ]);
      try {
        await proxyCacheService.getPackageVersionTarBuffer(
          'bar',
          'bar/-/bar-1.0.0.tgz',
        );
      } catch (error) {
        assert.equal(
          error,
          'ForbiddenError: stop proxy by block list: ["bar"]',
        );
      }
    });
  });

  describe('getPackageManifest()', () => {
    it('should invoke getSourceManifestAndCache first.', async () => {
      mock(proxyCacheService, 'getSourceManifestAndCache', async () => {
        return {
          manifest: { name: 'mock info' },
        };
      });
      const manifest = await proxyCacheService.getPackageManifest(
        'foo',
        DIST_NAMES.FULL_MANIFESTS,
      );
      assert.equal(manifest.name, 'mock info');
    });

    it('should read data from nfs when cached.', async () => {
      const nfsAdapter = await app.getEggObject(NFSAdapter);
      mock(proxyCacheService, 'getSourceManifestAndCache', async () => {
        return {
          storeKey: `/${PROXY_CACHE_DIR_NAME}/foo/${DIST_NAMES.FULL_MANIFESTS}`,
          manifest: { name: 'foo remote mock info' },
        };
      });
      await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        }),
      );
      mock(nfsAdapter, 'getBytes', async () => {
        return Buffer.from('{"name": "nfs mock info"}');
      });
      const manifest = await proxyCacheService.getPackageManifest(
        'foo',
        DIST_NAMES.FULL_MANIFESTS,
      );
      assert.equal(manifest.name, 'nfs mock info');
    });
  });

  describe('getPackageVersionManifest()', () => {
    it('should invoke getSourceManifestAndCache first.', async () => {
      mock(proxyCacheService, 'getSourceManifestAndCache', async () => {
        return {
          storeKey: `/${PROXY_CACHE_DIR_NAME}/foobar/1.0.0/${DIST_NAMES.MANIFEST}`,
          manifest: { name: 'mock package version info' },
        };
      });
      const manifest = await proxyCacheService.getPackageVersionManifest(
        'foo',
        DIST_NAMES.MANIFEST,
        '1.0.0',
      );
      assert.equal(manifest.name, 'mock package version info');
    });

    it('should read data from nfs when cached.', async () => {
      const nfsAdapter = await app.getEggObject(NFSAdapter);
      mock(proxyCacheService, 'getSourceManifestAndCache', async () => {
        return {
          storeKey: `/${PROXY_CACHE_DIR_NAME}/foo/1.0.0/${DIST_NAMES.FULL_MANIFESTS}`,
          manifest: { name: 'foo remote mock info' },
        };
      });
      await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo',
          fileType: DIST_NAMES.MANIFEST,
          version: '1.0.0',
        }),
      );
      mock(nfsAdapter, 'getBytes', async () => {
        return Buffer.from('{"name": "package version nfs mock info"}');
      });
      const manifest = await proxyCacheService.getPackageVersionManifest(
        'foo',
        DIST_NAMES.MANIFEST,
        '1.0.0',
      );
      assert.equal(manifest.name, 'package version nfs mock info');
    });

    it('should get correct verison via tag and cache the pkg manifest', async () => {
      // get manifest by http
      const pkgVersionManifest =
        await proxyCacheService.getPackageVersionManifest(
          'foobar',
          DIST_NAMES.MANIFEST,
          'latest',
        );
      assert(pkgVersionManifest);
      assert.equal(pkgVersionManifest.version, '1.1.0');
      const pkgManifest = proxyCacheRepository.findProxyCache(
        'foobar',
        DIST_NAMES.ABBREVIATED_MANIFESTS,
      );
      assert(pkgManifest);
    });
  });

  describe('getSourceManifestAndCache()', () => {
    it('should get full package manifest', async () => {
      const data = await TestUtil.readJSONFile(
        TestUtil.getFixtures('registry.npmjs.org/foobar.json'),
      );
      mock(npmRegistry, 'getFullManifests', async () => {
        return {
          status: 200,
          data,
        };
      });
      const { manifest } = await proxyCacheService.getSourceManifestAndCache(
        'foobar',
        DIST_NAMES.FULL_MANIFESTS,
      );
      const versionArr = Object.values(manifest.versions);
      for (const i of versionArr) {
        assert(i.dist.tarball.includes('http://localhost:7001'));
      }
    });

    it('should get abbreviated package manifest', async () => {
      const data = await TestUtil.readJSONFile(
        TestUtil.getFixtures('registry.npmjs.org/abbreviated_foobar.json'),
      );
      mock(npmRegistry, 'getAbbreviatedManifests', async () => {
        return {
          status: 200,
          data,
        };
      });
      const { manifest } = await proxyCacheService.getSourceManifestAndCache(
        'foobar',
        DIST_NAMES.ABBREVIATED_MANIFESTS,
      );
      const versionArr = Object.values(manifest.versions);
      for (const i of versionArr) {
        assert(i.dist.tarball.includes('http://localhost:7001'));
      }
    });

    it('should get full package version manifest', async () => {
      const data = await TestUtil.readJSONFile(
        TestUtil.getFixtures('registry.npmjs.org/foobar/1.0.0/package.json'),
      );
      mock(npmRegistry, 'getPackageVersionManifest', async () => {
        return {
          status: 200,
          data,
        };
      });
      const { manifest } = await proxyCacheService.getSourceManifestAndCache(
        'foobar',
        DIST_NAMES.MANIFEST,
        '1.0.0',
      );
      assert(manifest.dist);
      assert(manifest.dist.tarball.includes('http://localhost:7001'));
    });

    it('should get abbreviated package version manifest', async () => {
      const data = await TestUtil.readJSONFile(
        TestUtil.getFixtures(
          'registry.npmjs.org/foobar/1.0.0/abbreviated.json',
        ),
      );
      mock(npmRegistry, 'getAbbreviatedPackageVersionManifest', async () => {
        return {
          status: 200,
          data,
        };
      });
      const { manifest } = await proxyCacheService.getSourceManifestAndCache(
        'foobar',
        DIST_NAMES.ABBREVIATED,
        '1.0.0',
      );
      assert(manifest.dist);
      assert(manifest.dist.tarball.includes('http://localhost:7001'));
    });
  });

  describe('removeProxyCache()', () => {
    it('should remove cache', async () => {
      await proxyCacheRepository.saveProxyCache(ProxyCache.create({
        fullname: 'foo-bar',
        fileType: DIST_NAMES.ABBREVIATED,
        version: '1.0.0',
      }));

      await proxyCacheService.removeProxyCache(
        'foobar',
        DIST_NAMES.ABBREVIATED,
        '1.0.0',
      );

      const resultAfter = await proxyCacheRepository.findProxyCache(
        'foobar',
        DIST_NAMES.ABBREVIATED,
        '1.0.0',
      );
      console.log(resultAfter);
      assert.equal(resultAfter, undefined);
    });
  });

  describe('createTask(), findExecuteTask()', () => {
    it('should create task, and can be found.', async () => {
      const task = await proxyCacheService.createTask(
        `foobar/${DIST_NAMES.FULL_MANIFESTS}`,
        {
          fullname: 'foo',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        },
      );
      assert(task);
      assert.equal(task.targetName, `foobar/${DIST_NAMES.FULL_MANIFESTS}`);
      const task2 = await proxyCacheService.findExecuteTask();
      assert.equal(task.id, task2?.id);
    });
  });

  describe('executeTask()', () => {
    it('should throw not found error', async () => {
      const taskService = await app.getEggObject(TaskService);
      const task = await proxyCacheService.createTask(
        `foobar/${DIST_NAMES.FULL_MANIFESTS}`,
        {
          fullname: 'foo',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        },
      );
      await proxyCacheService.executeTask(task);
      const stream = await taskService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('can not found record in repo'));
    });

    it('should update success', async () => {
      const taskService = await app.getEggObject(TaskService);
      await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        }),
      );
      const task = await proxyCacheService.createTask(
        `foobar/${DIST_NAMES.FULL_MANIFESTS}`,
        {
          fullname: 'foo',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        },
      );
      await proxyCacheService.executeTask(task);
      const stream = await taskService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('Update Success'));
    });
  });
});
