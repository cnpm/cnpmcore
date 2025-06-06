import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

import { DIST_NAMES } from '../../../../app/core/entity/Package.js';
import { ProxyCache } from '../../../../app/core/entity/ProxyCache.js';
import { ProxyCacheRepository } from '../../../../app/repository/ProxyCacheRepository.js';
import { TaskRepository } from '../../../../app/repository/TaskRepository.js';
import { SyncMode } from '../../../../app/common/constants.js';
import { TestUtil } from '../../../TestUtil.js';

describe('test/port/controller/PackageVersionFileController/listFiles.test.ts', () => {
  let proxyCacheRepository: ProxyCacheRepository;
  beforeEach(async () => {
    proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
    await proxyCacheRepository.saveProxyCache(
      ProxyCache.create({
        fullname: 'foo-bar',
        fileType: DIST_NAMES.ABBREVIATED,
        version: '1.0.0',
      })
    );
    await proxyCacheRepository.saveProxyCache(
      ProxyCache.create({
        fullname: 'foo-bar',
        fileType: DIST_NAMES.ABBREVIATED_MANIFESTS,
      })
    );
    await proxyCacheRepository.saveProxyCache(
      ProxyCache.create({
        fullname: 'foobar',
        fileType: DIST_NAMES.ABBREVIATED,
        version: '1.0.0',
      })
    );
    await proxyCacheRepository.saveProxyCache(
      ProxyCache.create({
        fullname: 'foobar',
        fileType: DIST_NAMES.ABBREVIATED_MANIFESTS,
      })
    );
  });

  describe('[GET /-/proxy-cache] listProxyCache()', () => {
    it('should 403 when syncMode !== proxy', async () => {
      await app.httpRequest().get('/-/proxy-cache').expect(403);
    });

    it('should 200 when syncMode === proxy', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app.httpRequest().get('/-/proxy-cache').expect(200);
      assert.ok(res.body.data.length === 4);
    });

    it('should pageSize work', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res0 = await app
        .httpRequest()
        .get('/-/proxy-cache?pageSize=2&pageIndex=0')
        .expect(200);
      assert.ok(res0.body.data.length === 2);
      const res1 = await app
        .httpRequest()
        .get('/-/proxy-cache?pageSize=2&pageIndex=1')
        .expect(200);
      assert.ok(res1.body.data.length === 2);
      const res2 = await app
        .httpRequest()
        .get('/-/proxy-cache?pageSize=2&pageIndex=2')
        .expect(200);
      assert.ok(res2.body.data.length === 0);
      assert.ok(res2.body.count === 4);
    });
  });

  describe('[GET /-/proxy-cache/:fullname] showProxyCaches()', () => {
    it('should 403 when syncMode !== proxy', async () => {
      await app.httpRequest().get('/-/proxy-cache/foo-bar').expect(403);
    });

    it('should 200 when search "foo-bar"', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app
        .httpRequest()
        .get('/-/proxy-cache/foo-bar')
        .expect(200);
      assert.ok(res.body.count === 2);
    });

    it('should 404 when not found', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app
        .httpRequest()
        .get('/-/proxy-cache/foo-bar-xxx')
        .expect(200);
      assert.ok(res.body.count === 0);
    });
  });

  describe('[PATCH /-/proxy-cache/:fullname] refreshProxyCaches()', () => {
    it('should 403 when syncMode !== proxy', async () => {
      await app.httpRequest().patch('/-/proxy-cache/foo-bar').expect(403);
    });

    it('should create two tasks.', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const res = await app
        .httpRequest()
        .patch('/-/proxy-cache/foo-bar')
        .expect(200);
      // 仅需创建ABBREVIATED_MANIFESTS的更新任务
      assert.ok(res.body.tasks.length === 1);
      const taskRepository = await app.getEggObject(TaskRepository);
      const waitingTask = await taskRepository.findTask(
        res.body.tasks[0].taskId
      );
      assert.ok(waitingTask);
    });

    it('should 404 when not found', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      await app.httpRequest().patch('/-/proxy-cache/foo-bar-xxx').expect(404);
    });
  });

  describe('[DELETE /-/proxy-cache/:fullname] removeProxyCaches()', () => {
    it('should 403 when syncMode !== proxy', async () => {
      const adminUser = await TestUtil.createAdmin();
      await app
        .httpRequest()
        .delete('/-/proxy-cache/foo-bar')
        .set('authorization', adminUser.authorization)
        .expect(403);
    });

    it('should delete all packages about "foo-bar".', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const adminUser = await TestUtil.createAdmin();
      const res = await app
        .httpRequest()
        .delete('/-/proxy-cache/foo-bar')
        .set('authorization', adminUser.authorization)
        .expect(200);
      assert.ok(res.body.ok === true);
      // foo-bar
      assert.ok(res.body.result.length === 2);
      const res1 = await app.httpRequest().get('/-/proxy-cache').expect(200);
      // foobar
      assert.ok(res1.body.data.length === 2);
    });

    it('should 404 when not found', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const adminUser = await TestUtil.createAdmin();
      await app
        .httpRequest()
        .patch('/-/proxy-cache/foo-bar-xxx')
        .set('authorization', adminUser.authorization)
        .expect(404);
    });
  });

  describe('[DELETE /-/proxy-cache] truncateProxyCaches()', () => {
    it('should 403 when syncMode !== proxy', async () => {
      const adminUser = await TestUtil.createAdmin();
      await app
        .httpRequest()
        .delete('/-/proxy-cache')
        .set('authorization', adminUser.authorization)
        .expect(403);
    });

    it('should 403 when not login', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      await app.httpRequest().delete('/-/proxy-cache').expect(401);
    });

    it('should delete all packages about "foo-bar".', async () => {
      mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
      mock(app.config.cnpmcore, 'redirectNotFound', false);
      const adminUser = await TestUtil.createAdmin();
      await app
        .httpRequest()
        .delete('/-/proxy-cache')
        .set('authorization', adminUser.authorization)
        .expect(501);
    });
  });
});
