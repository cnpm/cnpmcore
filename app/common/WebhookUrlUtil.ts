import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

import { ForbiddenError } from 'egg/errors';
import { Agent, type Dispatcher } from 'egg/urllib';

/**
 * Network policy for webhook endpoints, from `config.cnpmcore.hookAllowPrivateNetwork`,
 * `config.cnpmcore.hookAllowedHosts` and `config.cnpmcore.hookAllowedCIDRs`.
 */
export interface WebhookNetworkOptions {
  allowPrivateNetwork?: boolean;
  allowedHosts?: string[];
  allowedCIDRs?: string[];
}

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
const WILDCARD_PREFIX_RE = /^\*\./;
const PREFIX_DIGITS_RE = /^\d{1,3}$/;

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
  list.addSubnet('fec0::', 10, 'ipv6'); // deprecated site-local
  list.addSubnet('ff00::', 8, 'ipv6');
  return list;
}

const PRIVATE_BLOCKS = buildPrivateBlockList();

function normalizeHostname(hostname: string): string {
  return hostname.replace(IPV6_BRACKETS_RE, '').toLowerCase().replace(TRAILING_DOT_RE, '');
}

/**
 * Match a hostname against `hookAllowedHosts`.
 * `example.com` matches only that host; `.example.com` or `*.example.com` matches its subdomains.
 */
export function isAllowlistedWebhookHost(hostname: string, allowedHosts?: string[]): boolean {
  if (!allowedHosts?.length) return false;
  const host = normalizeHostname(hostname);
  if (!host) return false;
  return allowedHosts.some((entry) => {
    const rule = normalizeHostname(entry.trim()).replace(WILDCARD_PREFIX_RE, '.');
    if (!rule) return false;
    if (rule.startsWith('.')) return host.endsWith(rule) && host.length > rule.length;
    return host === rule;
  });
}

const allowListCache = new Map<string, BlockList>();

/** Build a BlockList from `hookAllowedCIDRs` entries (`10.0.0.0/8`, `fd00::/8` or a single address). */
export function buildWebhookAllowList(cidrs?: string[]): BlockList | undefined {
  if (!cidrs?.length) return;
  const key = cidrs.join(',');
  const cached = allowListCache.get(key);
  if (cached) return cached;
  const list = new BlockList();
  for (const raw of cidrs) {
    const entry = raw.trim();
    const [address, prefixStr, ...rest] = entry.split('/');
    const version = isIP(address);
    const maxPrefix = version === 6 ? 128 : 32;
    if (!version || rest.length > 0 || (prefixStr !== undefined && !PREFIX_DIGITS_RE.test(prefixStr))) {
      throw new TypeError(`invalid config.cnpmcore.hookAllowedCIDRs entry: ${JSON.stringify(raw)}`);
    }
    const prefix = prefixStr === undefined ? maxPrefix : Number(prefixStr);
    if (prefix > maxPrefix) {
      throw new TypeError(`invalid config.cnpmcore.hookAllowedCIDRs entry: ${JSON.stringify(raw)}`);
    }
    list.addSubnet(address, prefix, version === 6 ? 'ipv6' : 'ipv4');
  }
  allowListCache.set(key, list);
  return list;
}

export function isBlockedWebhookIp(ip: string, allowList?: BlockList): boolean {
  const version = isIP(ip);
  if (!version) return true;
  const family = version === 6 ? 'ipv6' : 'ipv4';
  if (!PRIVATE_BLOCKS.check(ip, family)) return false;
  return !allowList?.check(ip, family);
}

/**
 * Create a DNS lookup that drops private/loopback/special-use addresses (except those in `allowList`),
 * so a public-looking hostname cannot be used to reach internal services at delivery time.
 */
export function createSafeWebhookLookup(allowList?: BlockList): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
      if (err) return callback(err, '', 0);
      const allowed = addresses.filter((item) => !isBlockedWebhookIp(item.address, allowList));
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
}

export const safeWebhookLookup: LookupFunction = createSafeWebhookLookup();

/** Dispatcher for webhook delivery, resolving hostnames through `safeWebhookLookup`. */
export const webhookHttpAgent = new Agent({
  connect: { lookup: safeWebhookLookup },
});

const allowListAgents = new WeakMap<BlockList, Agent>();

/**
 * Pick the dispatcher for delivering to `endpoint`.
 * Returns `undefined` (use the default client) when private networks are allowed or the host is allowlisted.
 */
export function getWebhookDispatcher(endpoint: string, options: WebhookNetworkOptions = {}): Dispatcher | undefined {
  if (options.allowPrivateNetwork) return;
  if (isAllowlistedWebhookHost(new URL(endpoint).hostname, options.allowedHosts)) return;
  const allowList = buildWebhookAllowList(options.allowedCIDRs);
  if (!allowList) return webhookHttpAgent;
  let agent = allowListAgents.get(allowList);
  if (!agent) {
    agent = new Agent({ connect: { lookup: createSafeWebhookLookup(allowList) } });
    allowListAgents.set(allowList, agent);
  }
  return agent;
}

/**
 * Reject webhook endpoints that are unsafe for server-side requests.
 * Non-http(s) schemes are always rejected. Unless allowed by `options`, local hostnames and
 * literal private IP addresses are rejected too; resolved addresses are checked again at
 * delivery time by the dispatcher from `getWebhookDispatcher`.
 */
export function assertSafeWebhookEndpoint(endpoint: string, options: WebhookNetworkOptions = {}): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ForbiddenError('endpoint must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ForbiddenError('endpoint must use http or https');
  }
  const hostname = normalizeHostname(url.hostname);
  if (!hostname) {
    throw new ForbiddenError('endpoint hostname is required');
  }
  if (options.allowPrivateNetwork || isAllowlistedWebhookHost(hostname, options.allowedHosts)) {
    return;
  }
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new ForbiddenError('endpoint hostname is not allowed');
  }
  if (isIP(hostname) && isBlockedWebhookIp(hostname, buildWebhookAllowList(options.allowedCIDRs))) {
    throw new ForbiddenError('endpoint must not target a private or loopback address');
  }
}

/** Placeholder returned instead of the stored webhook secret. */
export const MASKED_WEBHOOK_SECRET = '********';

/** Mask webhook secret for API responses (the full secret is only accepted on create/update). */
export function maskWebhookSecret(secret: string): string {
  return secret ? MASKED_WEBHOOK_SECRET : '';
}
