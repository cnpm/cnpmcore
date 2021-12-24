import assert = require('assert');
import { Context } from 'egg';
import { app } from 'egg-mock/bootstrap';

describe('test/port/controller/HomeController/ping.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /-/ping] ping()', () => {
    it('should 200', async () => {
      const res = await app.httpRequest()
        .get('/-/ping')
        .expect(200);
      assert.equal(res.body.pong, true);
      // console.log(res.body, res.headers['x-readtime']);
    });
  });
});
