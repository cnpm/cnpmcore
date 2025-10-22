import { app, mock } from '@eggjs/mock/bootstrap';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SyncMode } from '../../app/common/constants.ts';
import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository.ts';
import { ProxyCache } from '../../app/core/entity/ProxyCache.ts';
import { DIST_NAMES } from '../../app/core/entity/Package.ts';
import { ProxyCacheService } from '../../app/core/service/ProxyCacheService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SyncProxyCacheWorkerPath = path.join(__dirname, '../../app/port/schedule/SyncProxyCacheWorker.ts');

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
