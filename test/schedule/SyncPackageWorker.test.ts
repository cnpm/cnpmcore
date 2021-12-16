import { app, mock } from 'egg-mock/bootstrap';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';

describe('test/schedule/SyncPackageWorker.test.ts', () => {
  it('should sync worker success', async () => {
    const name = 'mk2test-module-cnpmsync-issue-1667';
    await app.httpRequest()
      .put(`/-/package/${name}/syncs`)
      .expect(201);

    Reflect.apply(Reflect.get(app, 'mockLog'), app, []);
    await app.runSchedule('SyncPackageWorker');
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ '[SyncPackageWorker:subscribe:executeTask:start]' ]);
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ '[SyncPackageWorker:subscribe:executeTask:success]' ]);
    // again should work
    await app.runSchedule('SyncPackageWorker');
  });

  it('should sync worker error', async () => {
    const name = 'mk2test-module-cnpmsync-issue-1667';
    await app.httpRequest()
      .put(`/-/package/${name}/syncs`)
      .expect(201);

    mock.error(PackageSyncerService.prototype, 'executeTask');
    Reflect.apply(Reflect.get(app, 'mockLog'), app, []);
    await app.runSchedule('SyncPackageWorker');
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ '[SyncPackageWorker:subscribe:executeTask:start]' ]);
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ '[SyncPackageWorker:subscribe:executeTask:error]' ]);
  });
});
