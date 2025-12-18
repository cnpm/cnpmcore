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

export function checkToken(token: string, prefix: string): boolean {
  const splits = token.split('_');
  if (splits.length !== 3) return false;
  if (splits[0] !== prefix) return false;
  try {
    const bytes = base62.decode(splits[1]);
    const crcBytes = base62.decode(splits[2]);
    // base-x v5 returns Uint8Array instead of Buffer, use DataView to read UInt32BE
    const dataView = new DataView(crcBytes.buffer, crcBytes.byteOffset, crcBytes.byteLength);
    return dataView.getUint32(0, false) === crc32(bytes);
  } catch {
    return false;
  }
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
