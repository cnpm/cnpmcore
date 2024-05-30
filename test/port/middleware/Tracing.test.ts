import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';

describe('test/port/middleware/Tracing.test.ts', () => {
  it('should set request-id header', async () => {
    const res = await app.httpRequest()
      .get('/')
      .expect(200);
    assert(res.headers['request-id']);
  });
});
