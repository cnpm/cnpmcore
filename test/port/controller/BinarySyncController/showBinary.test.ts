import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { BinarySyncerService } from 'app/core/service/BinarySyncerService';
import { NodeBinary } from 'app/common/adapter/binary/NodeBinary';
import { SqlcipherBinary } from 'app/common/adapter/binary/SqlcipherBinary';

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

  describe('[GET /binary.html] showBinaryHTML()', () => {
    it('should 200', async () => {
      const res = await app.httpRequest()
        .get('/binary.html');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'text/html; charset=utf-8');
      assert(res.text.includes('<body>'));
    });
  });

  describe('[GET /-/binary/:binary/(.*)] showBinary()', () => {
    it('should show root dirs', async () => {
      const res = await app.httpRequest()
        .get('/-/binary/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      const items = res.body;
      assert(items.length > 0);
      for (const item of items) {
        assert(item.type === 'dir');
        assert(item.name);
        assert(item.url);
        assert(item.repoUrl);
        assert(item.distUrl);
        assert(item.description);
      }
    });

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
      let items = res.body;
      assert(items.length === 2);

      res = await app.httpRequest()
        .get('/-/binary/node');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      items = res.body;
      assert(items.length === 2);

      res = await app.httpRequest()
        .get('/-/binary/node/latest/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      items = res.body;
      assert(items.length === 1);
      assert(items[0].name === 'docs/');
      assert(items[0].category === 'node');
      assert(items[0].type === 'dir');
      assert(items[0].size === undefined);
      assert(items[0].date);
      assert(items[0].id);
      assert(items[0].modified);
      assert(items[0].url.startsWith('http://'));

      res = await app.httpRequest()
        .get('/-/binary/node/latest/docs/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      items = res.body;
      assert(items.length === 1);
      assert(items[0].name === 'apilinks.json');
      assert(items[0].category === 'node');
      assert(items[0].type === 'file');
      assert(items[0].date);
      assert(items[0].id);
      assert(items[0].modified);
      assert(items[0].size > 0);
      assert(items[0].url.startsWith('http://'));

      res = await app.httpRequest()
        .get('/-/binary/node/latest/docs/apilinks.json');
      if (res.status === 200) {
        assert(res.headers['content-type'] === 'application/json; charset=utf-8');
        assert(res.headers['content-disposition'] === 'attachment; filename="apilinks.json"');
      } else {
        assert(res.status === 302);
      }

      res = await app.httpRequest()
        .get('/-/binary/node/foo/');
      assert(res.status === 404);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      let data = res.body;
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

    it('should show node binaries: /@journeyapps/sqlcipher', async () => {
      await binarySyncerService.createTask('@journeyapps/sqlcipher', {});
      const task = await binarySyncerService.findExecuteTask();
      assert(task);
      mock(SqlcipherBinary.prototype, 'fetch', async (dir: string) => {
        if (dir === '/') {
          return {
            items: [
              {
                name: 'v5.3.1/',
                date: '2021-12-14T13:12:31.587Z',
                size: '-',
                isDir: true,
                url: '',
              },
            ],
          };
        }
        if (dir === '/v5.3.1/') {
          return {
            items: [
              {
                name: 'napi-v6-win32-ia32.tar.gz',
                date: '2021-12-14T13:12:31.587Z',
                size: '-',
                isDir: false,
                url: 'https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.1/napi-v6-win32-ia32.tar.gz',
                ignoreDownloadStatuses: [ 404, 403 ],
              },
            ],
          };
        }
        return { items: [] };
      });
      await binarySyncerService.executeTask(task);

      let res = await app.httpRequest()
        .get('/-/binary/@journeyapps/sqlcipher/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      let items = res.body;
      assert(items.length === 1);

      res = await app.httpRequest()
        .get('/-/binary/@journeyapps/sqlcipher');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      items = res.body;
      assert(items.length === 1);
      assert(items[0].name === 'v5.3.1/');
      assert(items[0].category === '@journeyapps/sqlcipher');
      assert(items[0].type === 'dir');
      assert(items[0].size === undefined);

      res = await app.httpRequest()
        .get('/-/binary/@journeyapps/sqlcipher/v5.3.1/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      items = res.body;
      assert(items.length === 1);
      assert(items[0].name === 'napi-v6-win32-ia32.tar.gz');
      assert(items[0].category === '@journeyapps/sqlcipher');
      assert(items[0].type === 'file');
      assert(items[0].size === 1856939);
      assert(items[0].date === '2021-12-14T13:12:31.587Z');
      assert(items[0].id);
      assert(items[0].modified);
      assert(items[0].url.startsWith('http://'));

      res = await app.httpRequest()
        .get('/-/binary/@journeyapps/sqlcipher/v5.3.1/napi-v6-win32-ia32.tar.gz');
      if (res.status === 200) {
        assert(res.headers['content-type'] === 'application/gzip');
        assert(res.headers['content-disposition'] === 'attachment; filename="napi-v6-win32-ia32.tar.gz"');
      } else {
        assert(res.status === 302);
      }
    });
  });
});
