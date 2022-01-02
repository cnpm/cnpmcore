// import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
// import { BinarySyncerService } from 'app/core/service/BinarySyncerService';
import { NodeBinary } from 'app/common/adapter/binary/NodeBinary';

describe('test/schedule/SyncBinaryWorker.test.ts', () => {
  it('should ignore when enableBinarySync=false', async () => {
    await app.runSchedule('CreateSyncBinaryTask');
    app.mockLog();
    await app.runSchedule('SyncBinaryWorker');
    app.notExpectLog('[SyncBinaryWorker:executeTask:start]');
    app.notExpectLog('[SyncBinaryWorker:executeTask:success]');
  });

  it('should sync worker success', async () => {
    mock(app.config.cnpmcore, 'enableBinarySync', true);
    // create task
    await app.runSchedule('CreateSyncBinaryTask');
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
    await app.runSchedule('SyncBinaryWorker');
    app.expectLog('[SyncBinaryWorker:executeTask:start]');
    app.expectLog('targetName: node');
    app.expectLog('[SyncBinaryWorker:executeTask:success]');
    // again should work
    await app.runSchedule('SyncBinaryWorker');
  });

  it('should mock sync error', async () => {
    mock(app.config.cnpmcore, 'enableBinarySync', true);
    // create task
    await app.runSchedule('CreateSyncBinaryTask');
    mock.error(NodeBinary.prototype, 'fetch');

    app.mockLog();
    await app.runSchedule('SyncBinaryWorker');
    app.expectLog('[SyncBinaryWorker:executeTask:start]');
    app.expectLog('[BinarySyncerService.executeTask:fail]');
  });
});
