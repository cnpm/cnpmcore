import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/port/controller/HomeController/showTotal.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /] showTotal()', () => {
    it('should total information', async () => {
      const res = await app.httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.engine === app.config.orm.client);
      assert(data.node_version === process.version);
      assert(data.instance_start_time);
      assert(data.sync_model === 'none');
    });

    it('should show sync mode = all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.sync_model === 'all');
    });
  });
});
