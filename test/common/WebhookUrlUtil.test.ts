import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { ForbiddenError } from 'egg/errors';
import { request } from 'egg/urllib';

import {
  assertSafeWebhookEndpoint,
  isBlockedWebhookIp,
  maskWebhookSecret,
  safeWebhookLookup,
  webhookHttpAgent,
} from '../../app/common/WebhookUrlUtil.ts';

describe('test/common/WebhookUrlUtil.test.ts', () => {
  it('should allow public http(s) endpoints', () => {
    assertSafeWebhookEndpoint('https://example.com/hooks');
    assertSafeWebhookEndpoint('http://hooks.example.org/path');
    assertSafeWebhookEndpoint('https://8.8.8.8/hook');
    assertSafeWebhookEndpoint('https://[2001:4860:4860::8888]/hook');
  });

  it('should reject unsafe endpoints', () => {
    for (const endpoint of [
      'not a url',
      'file:///etc/passwd',
      'ftp://example.com/x',
      'http://127.0.0.1/x',
      'http://127.1/x',
      'http://2130706433/x',
      'http://0x7f000001/x',
      'http://0.0.0.0/x',
      'http://localhost/x',
      'http://LOCALHOST./x',
      'http://foo.localhost/x',
      'http://printer.local/x',
      'http://metadata.google.internal/x',
      'http://[::1]/x',
      'http://[::]/x',
      'http://[::ffff:127.0.0.1]/x',
      'http://[::ffff:7f00:1]/x',
      'http://[fd00::1]/x',
      'http://[fe80::1]/x',
      'http://10.0.0.5/x',
      'http://172.16.0.1/x',
      'http://192.168.1.1/x',
      'http://100.64.0.1/x',
      'http://169.254.169.254/latest/meta-data',
      'http://224.0.0.1/x',
      'http://255.255.255.255/x',
    ]) {
      assert.throws(() => assertSafeWebhookEndpoint(endpoint), ForbiddenError, endpoint);
    }
  });

  it('should classify ip addresses', () => {
    assert.equal(isBlockedWebhookIp('8.8.8.8'), false);
    assert.equal(isBlockedWebhookIp('2001:4860:4860::8888'), false);
    assert.equal(isBlockedWebhookIp('::ffff:8.8.8.8'), false);
    assert.equal(isBlockedWebhookIp('127.0.0.1'), true);
    assert.equal(isBlockedWebhookIp('::ffff:a9fe:a9fe'), true);
    assert.equal(isBlockedWebhookIp('64:ff9b::a00:1'), true);
    assert.equal(isBlockedWebhookIp('not-an-ip'), true);
  });

  it('should refuse hostnames resolving to private addresses', async () => {
    await assert.rejects(
      new Promise((resolve, reject) => {
        safeWebhookLookup('localhost', { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
      }),
      /disallowed address/,
    );
  });

  it('should not connect to private addresses via the webhook agent', async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      // sanity: reachable without the guarded agent
      const ok = await request(`http://127.0.0.1:${port}/`);
      assert.equal(ok.status, 200);
      await assert.rejects(
        request(`http://localhost:${port}/`, { dispatcher: webhookHttpAgent, timeout: 5000 }),
        /disallowed address/,
      );
      assert.equal(hits, 1);
    } finally {
      server.close();
    }
  });

  it('should mask secrets', () => {
    assert.equal(maskWebhookSecret('this is certainly very secret'), '********');
    assert.equal(maskWebhookSecret('ab'), '********');
    assert.equal(maskWebhookSecret(''), '');
  });
});
