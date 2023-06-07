import { app, mock } from 'egg-mock/bootstrap';
import { NodeBinary } from '../../app/common/adapter/binary/NodeBinary';
import { TestUtil } from '../../test/TestUtil';

const CreateSyncBinaryTaskPath = require.resolve('../../app/port/schedule/CreateSyncBinaryTask');
const SyncBinaryWorkerPath = require.resolve('../../app/port/schedule/SyncBinaryWorker');

describe('test/schedule/SyncBinaryWorker.test.ts', () => {
  it('should ignore when enableSyncBinary=false', async () => {
    await app.runSchedule(CreateSyncBinaryTaskPath);
    app.mockLog();
    await app.runSchedule(SyncBinaryWorkerPath);
    app.notExpectLog('[SyncBinaryWorker:executeTask:start]');
    app.notExpectLog('[SyncBinaryWorker:executeTask:success]');
  });

  it('should sync binary worker success', async () => {
    app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
      data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
      persist: false,
    });
    app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks.json', 'GET', {
      data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
      persist: false,
    });
    mock(app.config.cnpmcore, 'enableSyncBinary', true);
    // create task
    await app.runSchedule(CreateSyncBinaryTaskPath);
    mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
      if (dir === '/') {
        return {
          items: [
            { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
            { name: 'index.json', isDir: false, url: 'https://nodejs.org/dist/index.json', size: '219862', date: '17-Dec-2021 23:16' },
          ],
        };
      }
      if (dir === '/latest/') {
        return {
          items: [
            { name: 'docs/', isDir: true, url: '', size: '-', date: '17-Dec-2021 21:31' },
          ],
        };
      }
      if (dir === '/latest/docs/') {
        return {
          items: [
            { name: 'apilinks.json', isDir: false, url: 'https://nodejs.org/dist/latest/docs/apilinks.json', size: '61606', date: '17-Dec-2021 21:29' },
          ],
        };
      }
      return { items: [] };
    });

    app.mockLog();
    await app.runSchedule(SyncBinaryWorkerPath);
    app.expectLog('[SyncBinaryWorker:executeTask:start]');
    app.expectLog('targetName: node');
    app.expectLog('[SyncBinaryWorker:executeTask:success]');
    // again should work
    await app.runSchedule(SyncBinaryWorkerPath);
  });

  it('should mock sync error', async () => {
    mock(app.config.cnpmcore, 'enableSyncBinary', true);
    // create task
    await app.runSchedule(CreateSyncBinaryTaskPath);
    mock.error(NodeBinary.prototype, 'fetch');

    app.mockLog();
    await app.runSchedule(SyncBinaryWorkerPath);
    app.expectLog('[SyncBinaryWorker:executeTask:start]');
    app.expectLog('[BinarySyncerService.executeTask:fail]');
  });
});
