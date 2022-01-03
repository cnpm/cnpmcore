import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { BinarySyncerService } from 'app/core/service/BinarySyncerService';
import { Task as TaskModel } from 'app/repository/model/Task';
import { HistoryTask as HistoryTaskModel } from 'app/repository/model/HistoryTask';
import { TestUtil } from 'test/TestUtil';
import { NodeBinary } from 'app/common/adapter/binary/NodeBinary';
import { ApiBinary } from 'app/common/adapter/binary/ApiBinary';

describe('test/core/service/BinarySyncerService/executeTask.test.ts', () => {
  let ctx: Context;
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    binarySyncerService = await ctx.getEggObject(BinarySyncerService);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('executeTask()', () => {
    it('should execute "node" task', async () => {
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
      assert(log.includes('Syncing diff: 2 => 0'));
      assert(log.includes('[/] 🟢 Synced dir success'));

      // mock date change
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              { name: 'latest/', isDir: true, url: '', size: '-', date: '17-Dec-2021 23:17' },
              { name: 'index.json', isDir: false, url: 'https://nodejs.org/dist/index.json', size: '219862', date: '18-Dec-2021 23:16' },
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

    it('should execute "node" task with ApiBinary when sourceRegistryIsCNpm=true', async () => {
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
      assert(log.includes('Syncing diff: 2 => 0'));
      assert(log.includes('[/] 🟢 Synced dir success'));
    });
  });
});
