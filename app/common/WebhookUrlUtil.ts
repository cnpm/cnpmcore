import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

import { ForbiddenError } from 'egg/errors';
import { Agent } from 'egg/urllib';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc',
]);
const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];
const IPV6_BRACKETS_RE = /^\[|\]$/g;
const TRAILING_DOT_RE = /\.$/;

function buildPrivateBlockList(): BlockList {
  const list = new BlockList();
  // IPv4 private / special-use (RFC 6890)
  list.addSubnet('0.0.0.0', 8, 'ipv4');
  list.addSubnet('10.0.0.0', 8, 'ipv4');
  list.addSubnet('100.64.0.0', 10, 'ipv4'); // CGNAT
  list.addSubnet('127.0.0.0', 8, 'ipv4');
  list.addSubnet('169.254.0.0', 16, 'ipv4');
  list.addSubnet('172.16.0.0', 12, 'ipv4');
  list.addSubnet('192.0.0.0', 24, 'ipv4');
  list.addSubnet('192.0.2.0', 24, 'ipv4');
  list.addSubnet('192.168.0.0', 16, 'ipv4');
  list.addSubnet('198.18.0.0', 15, 'ipv4');
  list.addSubnet('198.51.100.0', 24, 'ipv4');
  list.addSubnet('203.0.113.0', 24, 'ipv4');
  list.addSubnet('224.0.0.0', 4, 'ipv4'); // multicast
  list.addSubnet('240.0.0.0', 4, 'ipv4'); // reserved + broadcast
  // IPv6 unspecified / loopback / ULA / link-local / multicast / NAT64 / 6to4 / documentation.
  // IPv4-mapped IPv6 addresses (any notation) are matched against the IPv4 rules above.
  list.addAddress('::', 'ipv6');
  list.addAddress('::1', 'ipv6');
  list.addSubnet('64:ff9b::', 96, 'ipv6');
  list.addSubnet('64:ff9b:1::', 48, 'ipv6');
  list.addSubnet('2001:db8::', 32, 'ipv6');
  list.addSubnet('2002::', 16, 'ipv6');
  list.addSubnet('fc00::', 7, 'ipv6');
  list.addSubnet('fe80::', 10, 'ipv6');
  list.addSubnet('ff00::', 8, 'ipv6');
  return list;
}

const PRIVATE_BLOCKS = buildPrivateBlockList();

export function isBlockedWebhookIp(ip: string): boolean {
  const version = isIP(ip);
  if (!version) return true;
  return PRIVATE_BLOCKS.check(ip, version === 6 ? 'ipv6' : 'ipv4');
}

/**
 * DNS lookup that drops private/loopback/special-use addresses, so a public-looking
 * hostname cannot be used to reach internal services at delivery time.
 */
export const safeWebhookLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, '', 0);
    const allowed = addresses.filter((item) => !isBlockedWebhookIp(item.address));
    if (allowed.length === 0) {
      const error = Object.assign(new Error(`webhook endpoint ${hostname} resolves to a disallowed address`), {
        code: 'ERR_WEBHOOK_ADDRESS_BLOCKED',
      });
      return callback(error, '', 0);
    }
    if (options.all) {
      return (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, allowed);
    }
    callback(null, allowed[0].address, allowed[0].family);
  });
};

/** Dispatcher for webhook delivery, resolving hostnames through `safeWebhookLookup`. */
export const webhookHttpAgent = new Agent({
  connect: { lookup: safeWebhookLookup },
});

/**
 * Reject webhook endpoints that are obviously unsafe for server-side requests.
 * Blocks non-http(s) schemes, local hostnames, and literal private IP addresses.
 * Resolved addresses are checked again at delivery time by `webhookHttpAgent`.
 */
export function assertSafeWebhookEndpoint(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ForbiddenError('endpoint must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ForbiddenError('endpoint must use http or https');
  }
  const hostname = url.hostname.replace(IPV6_BRACKETS_RE, '').toLowerCase().replace(TRAILING_DOT_RE, '');
  if (!hostname) {
    throw new ForbiddenError('endpoint hostname is required');
  }
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new ForbiddenError('endpoint hostname is not allowed');
  }
  if (isIP(hostname) && isBlockedWebhookIp(hostname)) {
    throw new ForbiddenError('endpoint must not target a private or loopback address');
  }
}

/** Mask webhook secret for API responses (the full secret is only accepted on create/update). */
export function maskWebhookSecret(secret: string): string {
  return secret ? '********' : '';
}
