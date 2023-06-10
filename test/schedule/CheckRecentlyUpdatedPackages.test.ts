import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { PackageSyncerService } from '../../app/core/service/PackageSyncerService';
import { TestUtil } from '../../test/TestUtil';

const CheckRecentlyUpdatedPackagesPath = require.resolve('../../app/port/schedule/CheckRecentlyUpdatedPackages');

describe('test/schedule/CheckRecentlyUpdatedPackages.test.ts', () => {
  let packageSyncerService: PackageSyncerService;
  beforeEach(async () => {
    packageSyncerService = await app.getEggObject(PackageSyncerService);
  });

  it('should work', async () => {
    app.mockLog();

    app.mockAgent()
      .get('https://www.npmjs.com')
      .intercept({
        method: 'GET',
        path: '/browse/updated',
        query: {
          offset: '0',
        },
      })
      .reply(200, await TestUtil.readFixturesFile('www.npmjs.com/browse/updated/offset-0.html'))
      .times(2);
    app.mockAgent()
      .get('https://www.npmjs.com')
      .intercept({
        method: 'GET',
        path: '/browse/updated',
        query: {
          offset: '36',
        },
      })
      .reply(200, await TestUtil.readFixturesFile('www.npmjs.com/browse/updated/offset-36.html'))
      .times(2);
    // syncMode=none
    mock(app.config.cnpmcore, 'syncMode', 'none');
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    app.notExpectLog('[CheckRecentlyUpdatedPackages.subscribe]');

    // syncMode=exist
    mock(app.config.cnpmcore, 'syncMode', 'exist');
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] request');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] parse');
    const executeTask = await packageSyncerService.findExecuteTask();
    assert(!executeTask);

    // syncMode=all
    mock(app.config.cnpmcore, 'syncMode', 'all');
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] request');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe][0] parse');
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe:createTask]');
    const task = await packageSyncerService.findExecuteTask();
    assert(task);
    app.mockAgent().assertNoPendingInterceptors();
  });

  it('should not sync packages with exist mode', async () => {
    await TestUtil.createPackage({
      name: '@cnpm/foo',
      version: '1.0.0',
      isPrivate: false,
    });
    app.mockLog();
    app.mockHttpclient(/https:\/\/www.npmjs.com\/browse\/updated/, () => {
      const ret = {
        context: {
          packages: [
            {
              name: 'test',
              version: '1.0.0',
            },
            {
              name: '@cnpm/foo',
              version: '1.1.0',
            },
          ],
        },
      };
      return `window.__context__ = ${JSON.stringify(ret)}</script>`;
    });
    mock(app.config.cnpmcore, 'syncMode', 'exist');
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    let task = await packageSyncerService.findExecuteTask();
    assert(task);
    assert(task.targetName === '@cnpm/foo');
    task = await packageSyncerService.findExecuteTask();
    assert(!task);
  });

  it('should handle pageUrl request error', async () => {
    mock(app.config.cnpmcore, 'syncMode', 'all');
    app.mockLog();
    app.mockHttpclient(/https:\/\/www.npmjs.com\/browse\/updated/, () => {
      throw new Error('mock http request error');
    });
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe:error][0] request');
    const task = await packageSyncerService.findExecuteTask();
    assert(!task);
  });

  it('should handle PackageSyncerService.createTask error', async () => {
    app.mockAgent()
      .get('https://www.npmjs.com')
      .intercept({
        method: 'GET',
        path: '/browse/updated',
        query: {
          offset: '0',
        },
      })
      .reply(200, await TestUtil.readFixturesFile('www.npmjs.com/browse/updated/offset-0.html'));
    app.mockAgent()
      .get('https://www.npmjs.com')
      .intercept({
        method: 'GET',
        path: '/browse/updated',
        query: {
          offset: '36',
        },
      })
      .reply(200, await TestUtil.readFixturesFile('www.npmjs.com/browse/updated/offset-36.html'));
    mock(app.config.cnpmcore, 'syncMode', 'all');
    app.mockLog();
    mock.error(PackageSyncerService.prototype, 'createTask');
    await app.runSchedule(CheckRecentlyUpdatedPackagesPath);
    app.expectLog('[CheckRecentlyUpdatedPackages.subscribe:error][0] parse');
    const task = await packageSyncerService.findExecuteTask();
    assert(!task);
    app.mockAgent().assertNoPendingInterceptors();
  });
});
