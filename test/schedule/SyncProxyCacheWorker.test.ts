import { app, mock } from 'egg-mock/bootstrap';
import { SyncMode } from '../../app/common/constants';
import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository';
import { ProxyCache } from '../../app/core/entity/ProxyCache';
import { DIST_NAMES } from '../../app/core/entity/Package';
import { ProxyCacheService } from '../../app/core/service/ProxyCacheService';

const SyncProxyCacheWorkerPath = require.resolve('../../app/port/schedule/SyncProxyCacheWorker');

describe('test/schedule/SyncProxyCacheWorker.test.ts', () => {

  beforeEach(async () => {
    mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
    mock(app.config.cnpmcore, 'redirectNotFound', false);
  });

  it('should execute task success', async () => {

    const proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
    const proxyCacheService = await app.getEggObject(ProxyCacheService);
    await proxyCacheRepository.saveProxyCache(ProxyCache.create({
      fullname: 'foobar',
      fileType: DIST_NAMES.FULL_MANIFESTS,
    }));


    await proxyCacheService.createTask(`foobar/${DIST_NAMES.ABBREVIATED_MANIFESTS}`, {
      fullname: 'foobar',
      fileType: DIST_NAMES.ABBREVIATED_MANIFESTS,
    });

    await app.runSchedule(SyncProxyCacheWorkerPath);
    app.expectLog('[SyncProxyCacheWorker:subscribe:executeTask:start]');
    app.expectLog('[SyncProxyCacheWorker:subscribe:executeTask:success]');
  });

});
