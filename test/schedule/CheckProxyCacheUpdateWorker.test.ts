import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, mock } from '@eggjs/mock/bootstrap';

import { SyncMode } from '../../app/common/constants.js';
import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository.js';
import { ProxyCache } from '../../app/core/entity/ProxyCache.js';
import { DIST_NAMES } from '../../app/core/entity/Package.js';
import { TaskService } from '../../app/core/service/TaskService.js';
import { TaskType } from '../../app/common/enum/Task.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CheckProxyCacheUpdateWorkerPath = path.join(__dirname, '../../app/port/schedule/CheckProxyCacheUpdateWorker.ts');

describe('test/schedule/CheckProxyCacheUpdateWorker.test.ts', () => {
  it('should create update task by repo', async () => {
    mock(app.config.cnpmcore, 'syncMode', SyncMode.proxy);
    mock(app.config.cnpmcore, 'redirectNotFound', false);
    const proxyCacheRepository = await app.getEggObject(ProxyCacheRepository);
    const taskService = await app.getEggObject(TaskService);
    await proxyCacheRepository.saveProxyCache(ProxyCache.create({
      fullname: 'foo-bar',
      fileType: DIST_NAMES.FULL_MANIFESTS,
    }));
    await app.runSchedule(CheckProxyCacheUpdateWorkerPath);
    const task = await taskService.findExecuteTask(TaskType.UpdateProxyCache);
    assert(task);
    assert.equal(task.targetName, `foo-bar/${DIST_NAMES.FULL_MANIFESTS}`);
  });

});
