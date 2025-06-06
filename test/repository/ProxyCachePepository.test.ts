import assert from 'node:assert/strict';
import { app } from '@eggjs/mock/bootstrap';

import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository.js';
import { ProxyCache } from '../../app/core/entity/ProxyCache.js';
import { DIST_NAMES } from '../../app/core/entity/Package.js';

describe('test/repository/ProxyCacheRepository.test.ts', () => {
  let proxyCacheRepository: ProxyCacheRepository;
  let proxyCacheModel: ProxyCache;

  beforeEach(async () => {
    proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
    proxyCacheModel = await proxyCacheRepository.saveProxyCache(
      ProxyCache.create({
        fullname: 'foo-bar',
        fileType: DIST_NAMES.FULL_MANIFESTS,
      })
    );
  });

  describe('ProxyCacheRepository', () => {
    it('create work', async () => {
      const newProxyCache = await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo-bar-new',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        })
      );
      assert.ok(newProxyCache);
      assert.equal(newProxyCache.fullname, 'foo-bar-new');
    });

    it('update work', async () => {
      const beforeUpdateTime = proxyCacheModel.updatedAt.getTime();
      const updatedProxyCache = await proxyCacheRepository.saveProxyCache(
        ProxyCache.update(proxyCacheModel)
      );
      assert.ok(updatedProxyCache);
      assert.equal(updatedProxyCache.fullname, 'foo-bar');
      const afterUpdateTime = updatedProxyCache.updatedAt.getTime();
      assert.ok(afterUpdateTime >= beforeUpdateTime);
    });

    it('list work', async () => {
      const proxyCaches = await proxyCacheRepository.listCachedFiles({});
      assert.ok(proxyCaches.count === 1);
    });

    it('query null', async () => {
      const queryRes = await proxyCacheRepository.findProxyCache(
        'not-exists',
        DIST_NAMES.FULL_MANIFESTS
      );
      assert.ok(queryRes === null);
    });

    it('query work', async () => {
      const queryRes = await proxyCacheRepository.findProxyCache(
        'foo-bar',
        DIST_NAMES.FULL_MANIFESTS
      );
      assert.ok(queryRes?.fullname === 'foo-bar');
    });

    it('remove work', async () => {
      await proxyCacheRepository.removeProxyCache(
        'foo-bar',
        DIST_NAMES.FULL_MANIFESTS
      );
      const { count } = await proxyCacheRepository.listCachedFiles({});
      assert.equal(count, 0);
    });

    it('truncate work', async () => {
      await proxyCacheRepository.saveProxyCache(
        ProxyCache.create({
          fullname: 'foo-bar-new',
          fileType: DIST_NAMES.FULL_MANIFESTS,
        })
      );
      await proxyCacheRepository.truncateProxyCache();
      const { count } = await proxyCacheRepository.listCachedFiles({});
      assert.equal(count, 0);
    });
  });
});
