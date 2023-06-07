import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { BinarySyncerService } from '../../../../app/core/service/BinarySyncerService';
import { NodeBinary } from '../../../../app/common/adapter/binary/NodeBinary';
import { SqlcipherBinary } from '../../../../app/common/adapter/binary/SqlcipherBinary';
import { BinaryRepository } from '../../../../app/repository/BinaryRepository';
import { Binary } from '../../../../app/core/entity/Binary';
import { NFSClientAdapter } from '../../../../app/infra/NFSClientAdapter';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/BinarySyncController/showBinary.test.ts', () => {
  let binarySyncerService: BinarySyncerService;
  let binaryRepository: BinaryRepository;
  let nfsClientAdapter: NFSClientAdapter;

  beforeEach(async () => {
    binarySyncerService = await app.getEggObject(BinarySyncerService);
    binaryRepository = await app.getEggObject(BinaryRepository);
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
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

    it('should show valid root dirs', async () => {
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.6.1/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
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

      const item = items.filter((item: any) => item.name === 'nwjs/');
      assert.deepStrictEqual(item, [{
        name: 'nwjs/',
        category: 'nwjs/',
        description: 'NW.js (previously known as node-webkit) lets you call all Node.js modules directly from DOM and enables a new way of writing applications with all Web technologies.',
        distUrl: 'https://dl.nwjs.io/',
        repoUrl: 'https://github.com/nwjs/nw.js',
        type: 'dir',
        url: 'http://localhost:7001/-/binary/nwjs/',
      }]);
    });

    it('should 404 when binary not exists', async () => {
      let res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt-not-exists/');
      assert.equal(res.status, 404);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.deepEqual(res.body, { error: '[NOT_FOUND] Binary "node-canvas-prebuilt-not-exists" not found' });

      res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt-not-exists/v2.6.1/');
      assert.equal(res.status, 404);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.deepEqual(res.body, { error: '[NOT_FOUND] Binary "node-canvas-prebuilt-not-exists" not found' });

      res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt-not-exists/v2.6.1/foo.json');
      assert.equal(res.status, 404);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.deepEqual(res.body, { error: '[NOT_FOUND] Binary "node-canvas-prebuilt-not-exists" not found' });
    });

    it('should show valid sub dirs', async () => {
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.6.1/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      const res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      const items = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);
      assert.deepStrictEqual(items, [{
        category: 'node-canvas-prebuilt',
        name: 'v2.6.1/',
        date: '2021-12-14T13:12:31.587Z',
        type: 'dir',
        url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/',
      }]);
    });

    it('should show valid files', async () => {
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.6.1/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/v2.6.1/',
        name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        isDir: false,
        size: 10,
        date: '2021-12-14T13:12:31.587Z',
      }));
      const res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt/v2.6.1/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      const items = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);
      assert(items.length > 0);

      assert.deepStrictEqual(items, [
        {
          category: 'node-canvas-prebuilt',
          name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
          date: '2021-12-14T13:12:31.587Z',
          type: 'file',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        },
      ]);
    });

    it('should forbidden invalid paths', async () => {
      const res = await app.httpRequest()
        .get('/-/binary/chromium-browser-snapshots/Linux_x64/970485/%E4%B8%8B%E8%BD%BD%E7%9A%84');
      assert.equal(res.status, 404);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.deepEqual(res.body, {
        error: '[NOT_FOUND] Binary "chromium-browser-snapshots/Linux_x64/970485/下载的" not found',
      });
    });

    it('should show node binaries', async () => {
      app.mockHttpclient('https://nodejs.org/dist/index.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/index.json'),
        persist: false,
      });
      app.mockHttpclient('https://nodejs.org/dist/latest/docs/apilinks.json', 'GET', {
        data: await TestUtil.readFixturesFile('nodejs.org/site/latest/docs/apilinks.json'),
        persist: false,
      });
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
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should show node binaries: /@journeyapps/sqlcipher', async () => {
      app.mockHttpclient('https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.1/napi-v6-win32-ia32.tar.gz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
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
      // assert(items[0].size === 1856939);
      // mock size
      assert(items[0].size === 10240);
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
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should merge category binaries when binaryName and category not equal', async () => {
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.6.1/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.7.0/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/v2.6.1/',
        name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        isDir: false,
        size: 10,
        date: '2021-12-14T13:12:31.587Z',
      }));

      await binaryRepository.saveBinary(Binary.create({
        category: 'canvas',
        parent: '/v2.7.0/',
        name: 'canvas-v2.7.0-node-v57-linux-glibc-x64.tar.gz',
        isDir: false,
        size: 10,
        date: '2021-12-14T13:12:31.587Z',
      }));

      await binaryRepository.saveBinary(Binary.create({
        category: 'canvas',
        parent: '/',
        name: 'v2.7.0/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));

      let res = await app.httpRequest()
        .get('/-/binary/canvas');

      assert.strictEqual(res.status, 200);
      assert(res.body);
      let stableData = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);
      assert.deepStrictEqual(stableData, [
        {
          category: 'canvas',
          name: 'v2.7.0/',
          date: '2021-12-14T13:12:31.587Z',
          type: 'dir',
          url: 'http://localhost:7001/-/binary/canvas/v2.7.0/',
        },
        {
          category: 'node-canvas-prebuilt',
          name: 'v2.6.1/',
          date: '2021-12-14T13:12:31.587Z',
          type: 'dir',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/',
        },
      ]);

      res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt');

      assert.strictEqual(res.status, 200);
      assert(res.body);
      stableData = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);
      assert.deepStrictEqual(stableData, [
        {
          category: 'node-canvas-prebuilt',
          name: 'v2.6.1/',
          date: '2021-12-14T13:12:31.587Z',
          type: 'dir',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/',
        },
        {
          category: 'node-canvas-prebuilt',
          name: 'v2.7.0/',
          date: '2021-12-14T13:12:31.587Z',
          type: 'dir',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.7.0/',
        },
      ]);

      res = await app.httpRequest()
        .get('/-/binary/canvas/v2.7.0/');

      assert.strictEqual(res.status, 200);
      assert(res.body);
      stableData = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);

      assert.deepStrictEqual(stableData, [
        {
          name: 'canvas-v2.7.0-node-v57-linux-glibc-x64.tar.gz',
          type: 'file',
          category: 'canvas',
          date: '2021-12-14T13:12:31.587Z',
          url: 'http://localhost:7001/-/binary/canvas/v2.7.0/canvas-v2.7.0-node-v57-linux-glibc-x64.tar.gz',
        },
      ]);

      res = await app.httpRequest()
        .get('/-/binary/canvas/v2.6.1/');

      assert.strictEqual(res.status, 200);
      assert(res.body);
      stableData = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);

      assert.deepStrictEqual(stableData, [
        {
          name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
          type: 'file',
          category: 'node-canvas-prebuilt',
          date: '2021-12-14T13:12:31.587Z',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        },
      ]);

      res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt/v2.6.1/');

      assert.strictEqual(res.status, 200);
      assert(res.body);
      stableData = TestUtil.pickKeys(res.body, [ 'category', 'name', 'date', 'type', 'url' ]);

      assert.deepStrictEqual(stableData, [
        {
          name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
          type: 'file',
          category: 'node-canvas-prebuilt',
          date: '2021-12-14T13:12:31.587Z',
          url: 'http://localhost:7001/-/binary/node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        },
      ]);

      res = await app.httpRequest()
        .get('/-/binary/canvas/v2.7.1/');
      assert.strictEqual(res.status, 404);

      res = await app.httpRequest()
        .get('/-/binary/node-canvas-prebuilt/v2.7.1/');

      assert.strictEqual(res.status, 404);
    });

    it('should get binary file success', async () => {
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.6.1/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/',
        name: 'v2.7.0/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));
      await binaryRepository.saveBinary(Binary.create({
        category: 'node-canvas-prebuilt',
        parent: '/v2.6.1/',
        name: 'node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz',
        isDir: false,
        size: 10,
        date: '2021-12-14T13:12:31.587Z',
      }));

      await binaryRepository.saveBinary(Binary.create({
        category: 'canvas',
        parent: '/v2.7.0/',
        name: 'canvas-v2.7.0-node-v57-linux-glibc-x64.tar.gz',
        isDir: false,
        size: 10,
        date: '2021-12-14T13:12:31.587Z',
      }));

      await binaryRepository.saveBinary(Binary.create({
        category: 'canvas',
        parent: '/',
        name: 'v2.7.0/',
        isDir: true,
        size: 0,
        date: '2021-12-14T13:12:31.587Z',
      }));

      mock(nfsClientAdapter, 'url', async (storeKey: string) => {
        return `https://cdn.mock.com${storeKey}`;
      });
      const res = await app.httpRequest()
        .get('/-/binary/canvas/v2.6.1/canvas-v2.6.1-node-v57-linux-glibc-x64.tar.gz');

      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, 'https://cdn.mock.com/binaries/node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz');
    });
  });
});
