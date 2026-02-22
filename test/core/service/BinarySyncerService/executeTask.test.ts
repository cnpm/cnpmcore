import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { ApiBinary } from '../../../../app/common/adapter/binary/ApiBinary.ts';
import { NodeBinary } from '../../../../app/common/adapter/binary/NodeBinary.ts';
import type { SyncBinaryTaskData } from '../../../../app/core/entity/Task.ts';
import { BinarySyncerService } from '../../../../app/core/service/BinarySyncerService.ts';
import { BinaryRepository } from '../../../../app/repository/BinaryRepository.ts';
import { HistoryTask as HistoryTaskModel } from '../../../../app/repository/model/HistoryTask.ts';
import { Task as TaskModel } from '../../../../app/repository/model/Task.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

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
      assert.ok(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      assert.ok(!(await TaskModel.findOne({ taskId: task.taskId })));
      assert.ok(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.match(log, /Syncing diff: 2 => 2/);
      assert.match(log, /\[\/\] 🟢 Synced dir success/);
      assert.match(log, /\[\/latest\/] 🟢 Synced dir success/);
      assert.match(log, /\[\/latest\/docs\/] 🟢 Synced dir success/);
      const items = await binarySyncerService.listRootBinaries('node');
      // sort by name first, postgres return items in random order
      items.sort((a, b) => a.name.localeCompare(b.name));
      // console.log(JSON.stringify(items, null, 2));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.match(log, /reason: revalidate latest version/);
      assert.match(log, /Syncing diff: 2 => 1/);
      assert.match(log, /\[\/\] 🟢 Synced dir success/);
      const items2 = await binarySyncerService.listRootBinaries('node');
      items2.sort((a, b) => a.name.localeCompare(b.name));
      // only "latest/" updatedAt changed, other should not change
      assert.equal(items[1].name, 'latest/');
      items[1].updatedAt = items2[1].updatedAt;
      assert.deepEqual(items, items2);

      // mock date change
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index.json',
                size: '219862',
                // change date
                date: '20-Dec-2021 23:16',
              },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.match(log, /Syncing diff: 2 => 1/);
      assert.match(log, /reason: date diff, local: "17-Dec-2021 23:16", remote: "20-Dec-2021 23:16"/);
      assert.match(log, /\[\/\] 🟢 Synced dir success/);
      const items3 = await binarySyncerService.listRootBinaries('node');
      items3.sort((a, b) => a.name.localeCompare(b.name));
      // only "index.json" `date, updatedAt` changed, other should not change
      assert.equal(items2[0].name, 'index.json');
      items2[0].date = items3[0].date;
      items2[0].updatedAt = items3[0].updatedAt;
      assert.deepEqual(items2, items3);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should mock download file error', async () => {
      await binarySyncerService.createTask('node', {});
      const task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index-not-exists.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks-not-exists.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
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
      assert.ok(!(await TaskModel.findOne({ taskId: task.taskId })));
      assert.ok(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('Syncing diff: 2 => 2'));
      assert.ok(log.includes('❌ [0.0.0] Download https://nodejs.org/dist/latest/docs/apilinks-not-exists.json'));
      assert.ok(log.includes('❌ [1] Download https://nodejs.org/dist/index-not-exists.json'));
      assert.ok(log.includes('[/] ❌ Synced dir fail'));
      assert.ok(log.includes('[/latest/] ❌ Synced dir fail'));
      assert.ok(log.includes('[/latest/docs/] ❌ Synced dir fail'));
    });

    it('should mock download file not found', async () => {
      await binarySyncerService.createTask('node', {});
      const task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index-not-exists.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks-not-exists.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
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
      assert.ok(!(await TaskModel.findOne({ taskId: task.taskId })));
      assert.ok(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('Syncing diff: 2 => 2'));
      assert.ok(
        log.includes(
          '🧪️ [0.0.0] Download https://nodejs.org/dist/latest/docs/apilinks-not-exists.json not found, skip it',
        ),
      );
      assert.ok(log.includes('🧪️ [1] Download https://nodejs.org/dist/index-not-exists.json not found, skip it'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/docs/] 🟢 Synced dir success'));
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
      assert.ok(task);
      mock(ApiBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://cnpmjs.org/mirrors/node/index.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://cnpmjs.org/mirrors/node/latest/docs/apilinks.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);
      assert.ok(!(await TaskModel.findOne({ taskId: task.taskId })));
      assert.ok(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('Syncing diff: 2 => 2'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/docs/] 🟢 Synced dir success'));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('reason: revalidate latest version'));
      assert.ok(log.includes('Syncing diff: 2 => 1'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));
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
      assert.ok(task);
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      assert.ok(!(await TaskModel.findOne({ taskId: task.taskId })));
      assert.ok(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('Syncing diff: 2 => 2'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/] 🟢 Synced dir success'));
      assert.ok(log.includes('[/latest/docs/] 🟢 Synced dir success'));

      // sync again
      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('reason: revalidate latest version'));
      assert.ok(log.includes('Syncing diff: 2 => 1'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));

      // mock version change
      // console.log(binaryRepository.findBinary('node'));

      // mock upstream updated
      mock(NodeBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'latest/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 23:17',
              },
              {
                name: 'index.json',
                isDir: false,
                url: 'https://nodejs.org/dist/index.json',
                size: '219862',
                date: '17-Dec-2021 23:16',
              },
            ],
          };
        }
        if (dir === '/latest/') {
          return {
            items: [
              {
                name: 'docs/',
                isDir: true,
                url: '',
                size: '-',
                date: '17-Dec-2021 21:31',
              },
            ],
          };
        }
        if (dir === '/latest/docs/') {
          return {
            items: [
              {
                name: 'apilinks.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks.json',
                size: '61606',
                date: '17-Dec-2021 21:29',
              },
              {
                name: 'apilinks2.json',
                isDir: false,
                url: 'https://nodejs.org/dist/latest/docs/apilinks.json',
                size: '61606',
                date: '18-Dec-2021 21:29',
              },
            ],
          };
        }
        return { items: [] };
      });

      await binarySyncerService.createTask('node', {});
      task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      await binarySyncerService.executeTask(task);
      stream = await binarySyncerService.findTaskLog(task);
      assert.ok(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert.ok(log.includes('"name":"apilinks2.json"'));
      assert.ok(log.includes('Syncing diff: 2 => 1'));
      assert.ok(log.includes('[/] 🟢 Synced dir success'));
      app.mockAgent().assertNoPendingInterceptors();
      const binaryRepository = await app.getEggObject(BinaryRepository);
      const BinaryItems = await binaryRepository.listBinaries('node', '/latest/docs/');
      assert.ok(BinaryItems.length === 2);
    });

    it('should fetch with task data', async () => {
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
        persist: false,
      });
      await binarySyncerService.createTask('node', {
        'mock-data': '2333',
      });
      let task = await binarySyncerService.findExecuteTask();
      assert.ok(task);
      let binaryName: string | undefined;
      let lastData: SyncBinaryTaskData | undefined;
      mock(NodeBinary.prototype, 'fetch', async (_dir: string, aBinaryName: string, aLastData?: SyncBinaryTaskData) => {
        binaryName = aBinaryName;
        lastData = aLastData;
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);
      assert.equal(binaryName, 'node');
      assert.equal(lastData?.['mock-data'], '2333');
    });
  });
});
