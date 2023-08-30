import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { BinarySyncerService } from '../../../../app/core/service/BinarySyncerService';
import { Task as TaskModel } from '../../../../app/repository/model/Task';
import { HistoryTask as HistoryTaskModel } from '../../../../app/repository/model/HistoryTask';
import { NodeBinary } from '../../../../app/common/adapter/binary/NodeBinary';
import { ApiBinary } from '../../../../app/common/adapter/binary/ApiBinary';
import { BinaryRepository } from '../../../../app/repository/BinaryRepository';

describe('test/core/service/BinarySyncerService/executeTask.test.ts', () => {
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    binarySyncerService = await app.getEggObject(BinarySyncerService);
  });

  describe('executeTask()', () => {
    it('should execute "node" task', async () => {
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
        persist: false,
      });
      await binarySyncerService.createTask('node', {});
      let task = await binarySyncerService.findExecuteTask();
      assert(task);
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
      await binarySyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 2'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/docs/] 🟢 Synced dir success'));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('reason: revalidate latest version'));
      assert(log.includes('Syncing diff: 2 => 1'));
      assert(log.includes('[/] 🟢 Synced dir success'));

      // mock date change
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
              { name: 'index.json', isDir: false, url: 'https://nodejs.org/dist/index.json', size: '219862',
                // change date
                date: '20-Dec-2021 23:16' },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 1'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should mock download file error', async () => {
      await binarySyncerService.createTask('node', {});
      const task = await binarySyncerService.findExecuteTask();
      assert(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
              { name: 'index.json', isDir: false, url: 'https://nodejs.org/dist/index-not-exists.json', size: '219862', date: '17-Dec-2021 23:16' },
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
              { name: 'apilinks.json', isDir: false, url: 'https://nodejs.org/dist/latest/docs/apilinks-not-exists.json', size: '61606', date: '17-Dec-2021 21:29' },
            ],
          };
        }
        return { items: [] };
      });
      app.mockHttpclient('https://nodejs.org/dist/index-not-exists.json', 'GET', {
        status: 500,
        data: 'mock error',
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks-not-exists.json', 'GET', {
        status: 500,
        data: 'mock error',
      });
      await binarySyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 2'));
      assert(log.includes('❌ [0.0.0] Download https://nodejs.org/dist/latest/docs/apilinks-not-exists.json'));
      assert(log.includes('❌ [1] Download https://nodejs.org/dist/index-not-exists.json'));
      assert(log.includes('[/] ❌ Synced dir fail'));
      assert(log.includes('[/latest/] ❌ Synced dir fail'));
      assert(log.includes('[/latest/docs/] ❌ Synced dir fail'));
    });

    it('should mock download file not found', async () => {
      await binarySyncerService.createTask('node', {});
      const task = await binarySyncerService.findExecuteTask();
      assert(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
              { name: 'index.json', isDir: false, url: 'https://nodejs.org/dist/index-not-exists.json', size: '219862', date: '17-Dec-2021 23:16' },
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
              { name: 'apilinks.json', isDir: false, url: 'https://nodejs.org/dist/latest/docs/apilinks-not-exists.json', size: '61606', date: '17-Dec-2021 21:29' },
            ],
          };
        }
        return { items: [] };
      });
      app.mockHttpclient('https://nodejs.org/dist/index-not-exists.json', 'GET', {
        status: 404,
        data: 'not found',
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks-not-exists.json', 'GET', {
        status: 404,
        data: 'not found',
      });
      await binarySyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 2'));
      assert(log.includes('🧪️ [0.0.0] Download https://nodejs.org/dist/latest/docs/apilinks-not-exists.json not found, skip it'));
      assert(log.includes('🧪️ [1] Download https://nodejs.org/dist/index-not-exists.json not found, skip it'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/docs/] 🟢 Synced dir success'));
    });

    it('should execute "node" task with ApiBinary when sourceRegistryIsCNpm=true', async () => {
      app.mockHttpclient('https://cnpmjs.org/mirrors/node/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      app.mockHttpclient('https://cnpmjs.org/mirrors/node/latest/docs/apilinks.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      await binarySyncerService.createTask('node', {});
      let task = await binarySyncerService.findExecuteTask();
      assert(task);
      mock(ApiBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
              { name: 'index.json', isDir: false, url: 'https://cnpmjs.org/mirrors/node/index.json', size: '219862', date: '17-Dec-2021 23:16' },
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
              { name: 'apilinks.json', isDir: false, url: 'https://cnpmjs.org/mirrors/node/latest/docs/apilinks.json', size: '61606', date: '17-Dec-2021 21:29' },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 2'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/docs/] 🟢 Synced dir success'));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('reason: revalidate latest version'));
      assert(log.includes('Syncing diff: 2 => 1'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should revalidate latest version', async () => {
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
        persist: false,
      });
      await binarySyncerService.createTask('node', {});
      let task = await binarySyncerService.findExecuteTask();
      assert(task);
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
      await binarySyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Syncing diff: 2 => 2'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/] 🟢 Synced dir success'));
      assert(log.includes('[/latest/docs/] 🟢 Synced dir success'));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('reason: revalidate latest version'));
      assert(log.includes('Syncing diff: 2 => 1'));
      assert(log.includes('[/] 🟢 Synced dir success'));

      // mock version change
      // console.log(binaryRepository.findBinary('node'));

      // mock upstream updated
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
              { name: 'apilinks2.json', isDir: false, url: 'https://nodejs.org/dist/latest/docs/apilinks.json', size: '61606', date: '18-Dec-2021 21:29' },
            ],
          };
        }
        return { items: [] };
      });

      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      await binarySyncerService.executeTask(task!);
      stream = await binarySyncerService.findTaskLog(task!);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('"name":"apilinks2.json"'));
      assert(log.includes('Syncing diff: 2 => 1'));
      assert(log.includes('[/] 🟢 Synced dir success'));
      app.mockAgent().assertNoPendingInterceptors();
      const binaryRepository = await app.getEggObject(BinaryRepository);
      const BinaryItems = await binaryRepository.listBinaries('node', '/latest/docs/');
      assert(BinaryItems.length === 2);

    });
  });
});
