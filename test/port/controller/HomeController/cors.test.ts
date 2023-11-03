import assert from 'assert';
import { app } from 'egg-mock/bootstrap';

describe('test/port/controller/HomeController/cors.test.ts', () => {
  describe('CORS', () => {
    it('should GET work', async () => {
      const res = await app.httpRequest()
        .get('/-/ping')
        .set('origin', 'https://www.test-cors.org');
      assert.equal(res.status, 200);
      assert.equal(res.body.pong, true);
      assert.equal(res.headers.vary, 'Origin');
      assert.equal(res.headers['access-control-allow-origin'], 'https://www.test-cors.org');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
      assert(!res.headers['access-control-allow-methods']);
    });

    it('should OPTIONS work', async () => {
      const res = await app.httpRequest()
        .options('/-/ping')
        .set('origin', 'https://www.test-cors.org/foo')
        .set('Access-Control-Request-Method', 'OPTIONS')
        .set('Access-Control-Request-Headers', 'authorization');
      assert.equal(res.status, 204);
      assert.equal(res.headers.vary, 'Origin');
      assert.equal(res.headers['access-control-allow-origin'], 'https://www.test-cors.org/foo');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
      assert.equal(res.headers['access-control-allow-headers'], 'authorization');
      assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS');
    });
  });
});
