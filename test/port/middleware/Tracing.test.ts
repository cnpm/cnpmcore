import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

describe('test/port/middleware/Tracing.test.ts', () => {
  it('should set request-id header', async () => {
    const res = await app.httpRequest().get('/').expect(200);
    assert.ok(res.headers['request-id']);
  });
});
