import assert from 'node:assert/strict';

import { ForbiddenError } from 'egg/errors';

import { assertSafeWebhookEndpoint, maskWebhookSecret } from '../../app/common/WebhookUrlUtil.ts';

describe('test/common/WebhookUrlUtil.test.ts', () => {
  it('should allow public https endpoints', () => {
    assertSafeWebhookEndpoint('https://example.com/hooks');
    assertSafeWebhookEndpoint('http://hooks.example.org/path');
  });

  it('should reject loopback and private literals', () => {
    for (const endpoint of [
      'http://127.0.0.1/x',
      'http://localhost/x',
      'http://[::1]/x',
      'http://10.0.0.5/x',
      'http://192.168.1.1/x',
      'http://169.254.169.254/latest/meta-data',
      'file:///etc/passwd',
      'ftp://example.com/x',
    ]) {
      assert.throws(() => assertSafeWebhookEndpoint(endpoint), ForbiddenError);
    }
  });

  it('should mask secrets', () => {
    assert.equal(maskWebhookSecret('this is certainly very secret'), 'this****');
    assert.equal(maskWebhookSecret('ab'), '****');
  });
});
