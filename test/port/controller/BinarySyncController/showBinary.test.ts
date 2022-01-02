import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { BinarySyncerService } from 'app/core/service/BinarySyncerService';
import { NodeBinary } from 'app/common/adapter/binary/NodeBinary';

describe('test/port/controller/BinarySyncController/showBinary.test.ts', () => {
  let ctx: Context;
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    binarySyncerService = await ctx.getEggObject(BinarySyncerService);
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /-/binary/:binary/(.*)] showBinary()', () => {
    it('should show node binaries', async () => {
      await binarySyncerService.createTask('node', {});
      const task = await binarySyncerService.findExecuteTask();
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

      let res = await app.httpRequest()
        .get('/-/binary/node/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      let data = res.body;
      assert(data.items.length === 2);

      res = await app.httpRequest()
        .get('/-/binary/node');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.items.length === 2);

      res = await app.httpRequest()
        .get('/-/binary/node/latest/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.items.length === 1);
      assert(data.items[0].name === 'docs/');

      res = await app.httpRequest()
        .get('/-/binary/node/latest/docs/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.items.length === 1);
      assert(data.items[0].name === 'apilinks.json');

      res = await app.httpRequest()
        .get('/-/binary/node/latest/docs/apilinks.json');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      assert(res.headers['content-disposition'] === 'attachment; filename="apilinks.json"');

      res = await app.httpRequest()
        .get('/-/binary/node/foo/');
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.error === '[NOT_FOUND] Binary "node/foo/" not found');

      res = await app.httpRequest()
        .get('/-/binary/node/foo.json');
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.error === '[NOT_FOUND] Binary "node/foo.json" not found');

      res = await app.httpRequest()
        .get('/-/binary/node/latest/docs/apilinks-404.json');
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      data = res.body;
      assert(data.error === '[NOT_FOUND] Binary "node/latest/docs/apilinks-404.json" not found');
    });
  });
});
