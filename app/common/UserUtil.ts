import crypto from 'node:crypto';
import { crc32 } from 'node:zlib';

import base from 'base-x';
import { checkData, create } from 'ssri';
import { UAParser } from 'ua-parser-js';

const base62 = base('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

const crc32Buffer = Buffer.alloc(4);

export function randomToken(prefix: string): string {
  const bytes = crypto.randomBytes(24);
  const crc = crc32(bytes);
  crc32Buffer.writeUInt32BE(crc);
  return `${prefix}_${base62.encode(bytes)}_${base62.encode(crc32Buffer)}`;
}

export function integrity(plain: string): string {
  return create().update(plain).digest().toString();
}

export function checkIntegrity(plain: string, expectedIntegrity: string): boolean {
  return !!checkData(plain, expectedIntegrity);
}

export function sha512(plain: string): string {
  return crypto.createHash('sha512').update(plain).digest('hex');
}

export function getUAInfo(userAgent?: string) {
  if (!userAgent) return null;
  return new UAParser(userAgent);
}

export function getBrowserTypeForWebauthn(userAgent?: string) {
  const ua = getUAInfo(userAgent);
  if (!ua) return null;
  const os = ua.getOS();
  if (os.name === 'iOS' || os.name === 'Android') return 'mobile';
  if (os.name === 'Mac OS') return ua.getBrowser().name;
  return null;
}
