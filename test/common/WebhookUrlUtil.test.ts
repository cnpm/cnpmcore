import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { ForbiddenError } from 'egg/errors';
import { request } from 'egg/urllib';

import {
  assertSafeWebhookEndpoint,
  buildWebhookAllowList,
  getWebhookDispatcher,
  isAllowlistedWebhookHost,
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
      'http://[fec0::1]/x',
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

  describe('network options', () => {
    it('should keep rejecting private targets by default', () => {
      assert.throws(() => assertSafeWebhookEndpoint('http://10.0.0.5/x', {}), ForbiddenError);
      assert.throws(
        () => assertSafeWebhookEndpoint('http://hooks.corp.internal/x', { allowPrivateNetwork: false }),
        ForbiddenError,
      );
      assert.equal(getWebhookDispatcher('https://example.com/x'), webhookHttpAgent);
    });

    it('should allow private targets when allowPrivateNetwork is enabled', () => {
      const options = { allowPrivateNetwork: true };
      for (const endpoint of [
        'http://127.0.0.1:8080/x',
        'http://localhost/x',
        'http://10.0.0.5/x',
        'http://[fd00::1]/x',
        'http://hooks.corp.internal/x',
      ]) {
        assertSafeWebhookEndpoint(endpoint, options);
      }
      assert.equal(getWebhookDispatcher('http://10.0.0.5/x', options), undefined);
    });

    it('should still reject non-http(s) schemes when private networks are allowed', () => {
      const options = { allowPrivateNetwork: true, allowedHosts: ['example.com'], allowedCIDRs: ['0.0.0.0/0'] };
      for (const endpoint of ['file:///etc/passwd', 'ftp://example.com/x', 'gopher://10.0.0.5/x', 'not a url']) {
        assert.throws(() => assertSafeWebhookEndpoint(endpoint, options), ForbiddenError, endpoint);
      }
    });

    it('should allow allowlisted hosts only', () => {
      const options = { allowedHosts: ['ci.corp.internal', '.hooks.corp', '*.svc.cluster.local'] };
      assertSafeWebhookEndpoint('http://ci.corp.internal/x', options);
      assertSafeWebhookEndpoint('http://CI.corp.internal./x', options);
      assertSafeWebhookEndpoint('http://a.hooks.corp/x', options);
      assertSafeWebhookEndpoint('http://jenkins.ci.svc.cluster.local/x', options);
      assert.throws(() => assertSafeWebhookEndpoint('http://other.corp.internal/x', options), ForbiddenError);
      assert.equal(isAllowlistedWebhookHost('hooks.corp', options.allowedHosts), false);
      assert.equal(isAllowlistedWebhookHost('evilhooks.corp', options.allowedHosts), false);
      assert.throws(() => assertSafeWebhookEndpoint('http://10.0.0.5/x', options), ForbiddenError);
      assert.equal(isAllowlistedWebhookHost('ci.corp.internal.evil.com', options.allowedHosts), false);
      // allowlisted hosts are trusted at delivery time, other hosts keep the guarded dispatcher
      assert.equal(getWebhookDispatcher('http://ci.corp.internal/x', options), undefined);
      assert.equal(getWebhookDispatcher('https://example.com/x', options), webhookHttpAgent);
    });

    it('should allow addresses in allowed CIDRs only', () => {
      const options = { allowedCIDRs: ['10.10.0.0/16', '192.168.1.20', 'fd00:1::/32'] };
      assertSafeWebhookEndpoint('http://10.10.3.4/x', options);
      assertSafeWebhookEndpoint('http://192.168.1.20/x', options);
      assertSafeWebhookEndpoint('http://[fd00:1::5]/x', options);
      assertSafeWebhookEndpoint('http://[::ffff:10.10.3.4]/x', options);
      assert.throws(() => assertSafeWebhookEndpoint('http://10.11.0.1/x', options), ForbiddenError);
      assert.throws(() => assertSafeWebhookEndpoint('http://192.168.1.21/x', options), ForbiddenError);
      assert.throws(() => assertSafeWebhookEndpoint('http://127.0.0.1/x', options), ForbiddenError);
      // blocked hostnames still need hookAllowedHosts
      assert.throws(() => assertSafeWebhookEndpoint('http://localhost/x', options), ForbiddenError);
      const allowList = buildWebhookAllowList(options.allowedCIDRs);
      assert.equal(isBlockedWebhookIp('10.10.3.4', allowList), false);
      assert.equal(isBlockedWebhookIp('10.11.0.1', allowList), true);
      assert.equal(isBlockedWebhookIp('8.8.8.8', allowList), false);
      const dispatcher = getWebhookDispatcher('https://example.com/x', options);
      assert.ok(dispatcher);
      assert.notEqual(dispatcher, webhookHttpAgent);
      assert.equal(
        getWebhookDispatcher('https://example.org/x', { allowedCIDRs: [...options.allowedCIDRs] }),
        dispatcher,
      );
    });

    it('should throw on invalid CIDR config', () => {
      for (const entry of ['10.0.0.0/33', 'fd00::/129', 'not-an-ip', '10.0.0.0/8/1', '10.0.0.0/abc', '10.0.0.0/']) {
        assert.throws(() => buildWebhookAllowList([entry]), /hookAllowedCIDRs/, entry);
      }
    });

    it('should connect to allowed private addresses after DNS resolution', async () => {
      const server = http.createServer((_req, res) => res.end('ok'));
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      try {
        const dispatcher = getWebhookDispatcher(`http://localhost:${port}/`, { allowedCIDRs: ['127.0.0.0/8'] });
        const res = await request(`http://localhost:${port}/`, { dispatcher, timeout: 5000 });
        assert.equal(res.status, 200);
        await assert.rejects(
          request(`http://localhost:${port}/`, {
            dispatcher: getWebhookDispatcher(`http://localhost:${port}/`, { allowedCIDRs: ['10.0.0.0/8'] }),
            timeout: 5000,
          }),
          /disallowed address/,
        );
      } finally {
        server.close();
      }
    });
  });
});
