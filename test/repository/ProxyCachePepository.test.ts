import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository';
import { ProxyCache } from '../../app/core/entity/ProxyCache';
import { DIST_NAMES } from '../../app/core/entity/Package';
import { PROXY_MODE_CACHED_PACKAGE_DIR_NAME } from '../../app/common/constants';

describe('test/repository/ProxyCacheRepository.test.ts', () => {
  let proxyCacheRepository: ProxyCacheRepository;
  let proxyCacheModel: ProxyCache;

  beforeEach(async () => {
    proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
    proxyCacheModel = await proxyCacheRepository.saveProxyCache(ProxyCache.create({
      fullname: 'foo-bar',
      fileType: DIST_NAMES.FULL_MANIFESTS,
      filePath: `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/foo-bar/${DIST_NAMES.FULL_MANIFESTS}`,
    }));
  });

  describe('ProxyCacheRepository', () => {
    it('create work', async () => {
      proxyCacheRepository;
      const newProxyCache = await proxyCacheRepository.saveProxyCache(ProxyCache.create({
        fullname: 'foo-bar-new',
        fileType: DIST_NAMES.FULL_MANIFESTS,
        filePath: `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/foo-bar-new/${DIST_NAMES.FULL_MANIFESTS}`,
      }));
      assert(newProxyCache);
      assert(newProxyCache.fullname === 'foo-bar-new');
    });

    it('update work', async () => {
      const beforeUpdateTime = proxyCacheModel.updatedAt.getTime();
      const updatedProxyCache = await proxyCacheRepository.saveProxyCache(ProxyCache.update(proxyCacheModel));
      assert(updatedProxyCache);
      assert(updatedProxyCache.fullname === 'foo-bar');
      const afterUpdateTime = updatedProxyCache.updatedAt.getTime();
      assert(afterUpdateTime !== beforeUpdateTime);
      assert(afterUpdateTime - beforeUpdateTime < 1000);
    });

    it('list work', async () => {
      const proxyCaches = await proxyCacheRepository.listCachedFiles({});
      assert(proxyCaches.count === 1);
    });

    it('query null', async () => {
      const queryRes = await proxyCacheRepository.findProxyCache('not-exists', DIST_NAMES.FULL_MANIFESTS);
      assert(queryRes === null);
    });

    it('query work', async () => {
      const queryRes = await proxyCacheRepository.findProxyCache('foo-bar', DIST_NAMES.FULL_MANIFESTS);
      assert(queryRes?.fullname === 'foo-bar');
    });

    it('remove work', async () => {
      await proxyCacheRepository.removeProxyCache('foo-bar', DIST_NAMES.FULL_MANIFESTS);
      const emptyRes = await proxyCacheRepository.listCachedFiles({});
      assert.deepEqual(emptyRes.data, []);
    });
  });
});
