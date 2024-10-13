import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { SyncMode } from '../../app/common/constants';
import { ProxyCacheRepository } from '../../app/repository/ProxyCacheRepository';
import { ProxyCache } from '../../app/core/entity/ProxyCache';
import { DIST_NAMES } from '../../app/core/entity/Package';
import { TaskService } from '../../app/core/service/TaskService';
import { TaskType } from '../../app/common/enum/Task';

const CheckProxyCacheUpdateWorkerPath = require.resolve('../../app/port/schedule/CheckProxyCacheUpdateWorker');

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
