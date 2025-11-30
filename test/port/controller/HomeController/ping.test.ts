import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

describe('test/port/controller/HomeController/ping.test.ts', () => {
  describe('[GET /-/ping] ping()', () => {
    it('should 200', async () => {
      const res = await app.httpRequest().get('/-/ping').expect(200);
      assert.ok(res.body.pong === true);
      // console.log(res.body, res.headers['x-readtime']);
      assert.ok(res.headers['x-frame-options'] === 'SAMEORIGIN');
    });
  });
});
