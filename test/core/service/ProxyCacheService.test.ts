import assert from 'node:assert';
import { app, mock } from '@eggjs/mock/bootstrap';
import { Context } from 'egg';
import { TestUtil } from '../../TestUtil';
import { ProxyCacheService } from '../../../app/core/service/ProxyCacheService';
import { ProxyCacheRepository } from '../../../app/repository/ProxyCacheRepository';
import { DIST_NAMES } from '../../../app/core/entity/Package';
import { NFSAdapter } from '../../../app/common/adapter/NFSAdapter';
import { ProxyCache } from '../../../app/core/entity/ProxyCache';
import { TaskService } from '../../../app/core/service/TaskService';

describe('test/core/service/ProxyCacheService/index.test.ts', () => {
  let proxyCacheService: ProxyCacheService;
  let proxyCacheRepository: ProxyCacheRepository;

  beforeEach(async () => {
    proxyCacheService = await app.getEggObject(ProxyCacheService);
    proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
  });

  describe('getPackageVersionTarResponse()', () => {
    it('should stop proxy when hit block list', async () => {
      const name = 'cnpmcore-test-sync-blocklist';
      mock(app.config.cnpmcore, 'syncPackageBlockList', [ name ]);
      try {
        await proxyCacheService.getPackageVersionTarResponse(name, app.mockContext() as Context);
      } catch (error) {
        assert(error.options.message.includes('block list'));
      }
    });
  });

  describe('getPackageManifest()', () => {
    it('should invoke getRewrittenManifest first.', async () => {
      mock(proxyCacheService, 'getRewrittenManifest', async () => {
        return { name: 'mock info' };
      });
      const manifest = await proxyCacheService.getPackageManifest(
        'foo',
        DIST_NAMES.FULL_MANIFESTS,
      );
      assert.equal(manifest.name, 'mock info');
    });

    it('should read data from nfs when cached.', async () => {
      const nfsAdapter = await app.getEggObject(NFSAdapter);
      mock(proxyCacheService, 'getRewrittenManifest', async () => {
        return { name: 'foo remote mock info' };
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
    it('should invoke getRewrittenManifest first.', async () => {
      mock(proxyCacheService, 'getRewrittenManifest', async () => {
        return { name: 'mock package version info' };
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
      mock(proxyCacheService, 'getRewrittenManifest', async () => {
        return { name: 'foo remote mock info' };
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
      app.mockHttpclient('https://registry.npmjs.org/foobar/latest', 'GET', {
        data: await TestUtil.readFixturesFile(
          'registry.npmjs.org/foobar/1.0.0/abbreviated.json',
        ),
        persist: false,
      });

      mock(proxyCacheService, 'getUpstreamAbbreviatedManifests', async () => {
        return {
          status: 200,
          data: await TestUtil.readJSONFile(
            TestUtil.getFixtures('registry.npmjs.org/abbreviated_foobar.json'),
          ),
        };
      });
      // get manifest by http
      const pkgVersionManifest =
        await proxyCacheService.getPackageVersionManifest(
          'foobar',
          DIST_NAMES.MANIFEST,
          'latest',
        );
      assert(pkgVersionManifest);
      assert.equal(pkgVersionManifest.version, '1.0.0');
    });
  });

  describe('removeProxyCache()', () => {
    it('should remove cache', async () => {
      await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo-bar',
          fileType: DIST_NAMES.ABBREVIATED,
          version: '1.0.0',
        }),
      );

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

    it('should be 500 when file type is package version manifest.', async () => {
      try {
        await proxyCacheService.createTask(
          `foobar/${DIST_NAMES.FULL_MANIFESTS}`,
          {
            fullname: 'foo',
            fileType: DIST_NAMES.MANIFEST,
          },
        );
      } catch (error) {
        assert.equal(error.status, 500);
      }
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
          fullname: 'foobar',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        }),
      );
      const task = await proxyCacheService.createTask(
        `foobar/${DIST_NAMES.FULL_MANIFESTS}`,
        {
          fullname: 'foobar',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        },
      );
      mock(proxyCacheService, 'getPackageVersionManifest', async () => {
        return {
          status: 200,
          data: await TestUtil.readJSONFile(
            TestUtil.getFixtures('registry.npmjs.org/foobar.json'),
          ),
        };
      });
      await proxyCacheService.executeTask(task);
      const stream = await taskService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('Update Success'));
    });
  });
});
