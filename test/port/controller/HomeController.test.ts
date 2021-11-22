import { strict as assert } from 'assert';
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/port/controller/PackageController.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    mock.restore();
  });

  describe('[GET /] showTotal()', () => {
    it('should total information', async () => {
      const res = await app.httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      // console.log(data);
      assert.equal(data.engine, app.config.orm.client);
      assert.equal(data.node_version, process.version);
      assert(data.instance_start_time > 0);
      // microseconds
      assert.equal(String(data.instance_start_time).length, 16);
    });
  });
});
