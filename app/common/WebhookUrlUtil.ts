import { BlockList, isIP } from 'node:net';

import { ForbiddenError } from 'egg/errors';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

function buildPrivateBlockList(): BlockList {
  const list = new BlockList();
  // IPv4 private / special-use
  list.addSubnet('0.0.0.0', 8, 'ipv4');
  list.addSubnet('10.0.0.0', 8, 'ipv4');
  list.addSubnet('127.0.0.0', 8, 'ipv4');
  list.addSubnet('169.254.0.0', 16, 'ipv4');
  list.addSubnet('172.16.0.0', 12, 'ipv4');
  list.addSubnet('192.168.0.0', 16, 'ipv4');
  list.addSubnet('100.64.0.0', 10, 'ipv4'); // CGNAT
  // IPv6 loopback / link-local / ULA
  list.addAddress('::1', 'ipv6');
  list.addSubnet('fc00::', 7, 'ipv6');
  list.addSubnet('fe80::', 10, 'ipv6');
  return list;
}

const PRIVATE_BLOCKS = buildPrivateBlockList();

function isBlockedIp(ip: string): boolean {
  let normalized = ip;
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  const version = isIP(normalized);
  if (!version) return false;
  return PRIVATE_BLOCKS.check(normalized, version === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Reject webhook endpoints that are obviously unsafe for server-side requests.
 * Blocks non-http(s) schemes, localhost hostnames, and literal private IP addresses.
 * Does not perform DNS resolution (operators should still treat hookEnable carefully).
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
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new ForbiddenError('endpoint hostname is required');
  }
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new ForbiddenError('endpoint hostname is not allowed');
  }
  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new ForbiddenError('endpoint must not target a private or loopback address');
  }
}

/** Mask webhook secret for API responses (create still accepts full secret). */
export function maskWebhookSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return `${secret.slice(0, 4)}****`;
}
