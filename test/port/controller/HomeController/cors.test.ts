import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';

describe('test/port/controller/HomeController/cors.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    await app.destroyModuleContext(ctx);
  });

  describe('CORS', () => {
    it('should GET work', async () => {
      const res = await app.httpRequest()
        .get('/-/ping')
        .set('origin', 'https://www.test-cors.org');
      assert(res.status === 200);
      assert(res.body.pong === true);
      assert(res.headers.vary === 'Origin');
      assert(res.headers['access-control-allow-origin'] === 'https://www.test-cors.org');
      assert(res.headers['access-control-allow-credentials'] === 'true');
    });

    it('should OPTIONS work', async () => {
      const res = await app.httpRequest()
        .options('/-/ping')
        .set('origin', 'https://www.test-cors.org/foo')
        .set('Access-Control-Request-Method', 'OPTIONS')
        .set('Access-Control-Request-Headers', 'authorization');
      assert(res.status === 204);
      assert(res.headers.vary === 'Origin');
      assert(res.headers['access-control-allow-origin'] === 'https://www.test-cors.org/foo');
      assert(res.headers['access-control-allow-credentials'] === 'true');
      assert(res.headers['access-control-allow-headers'] === 'authorization');
    });
  });
});
