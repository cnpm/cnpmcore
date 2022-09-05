import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';

const SyncPackageWorkerPath = require.resolve('../../app/port/schedule/SyncPackageWorker');

describe('test/schedule/SyncPackageWorker.test.ts', () => {
  beforeEach(async () => {
    mock(app.config.cnpmcore, 'syncMode', 'all');
  });

  it('should sync worker success', async () => {
    const name = 'mk2test-module-cnpmsync-issue-1667';
    await app.httpRequest()
      .put(`/-/package/${name}/syncs`)
      .expect(201);

    app.mockLog();
    await app.runSchedule(SyncPackageWorkerPath);
    app.expectLog('[SyncPackageWorker:subscribe:executeTask:start]');
    app.expectLog('[SyncPackageWorker:subscribe:executeTask:success]');
    // again should work
    await app.runSchedule(SyncPackageWorkerPath);

    const res = await app.httpRequest()
      .get(`/${name}`)
      .set('Accept', 'application/json')
      .expect(200);
    // make sure npm user name not contain 'npm:'
    assert(res.body.maintainers[0].name === 'fengmk2');
  });

  it('should sync long name from npm https://github.com/npm/npm/issues/8077', async () => {
    const name = 'ifyouwanttogetthesumoftwonumberswherethosetwonumbersarechosenbyfindingthelargestoftwooutofthreenumbersandsquaringthemwhichismultiplyingthembyitselfthenyoushouldinputthreenumbersintothisfunctionanditwilldothatforyou';
    await app.httpRequest()
      .put(`/-/package/${name}/syncs`)
      .expect(201);

    await app.runSchedule(SyncPackageWorkerPath);
    const res = await app.httpRequest()
      .get(`/${name}`)
      .set('Accept', 'application/json');
    assert(res.status === 200);
    assert(res.body.name === name);
  });

  it('should sync worker error', async () => {
    const name = 'mk2test-module-cnpmsync-issue-1667';
    let res = await app.httpRequest()
      .put(`/-/package/${name}/syncs`)
      .expect(201);

    mock.error(PackageSyncerService.prototype, 'executeTask');
    app.mockLog();
    await app.runSchedule(SyncPackageWorkerPath);
    app.expectLog('[SyncPackageWorker:subscribe:executeTask:start]');
    app.expectLog('[SyncPackageWorker:subscribe:executeTask:error]');

    res = await app.httpRequest()
      .get(`/-/package/${name}/syncs/${res.body.id}`)
      .expect(200);
    assert.equal(res.body.state, 'processing');
  });
});
