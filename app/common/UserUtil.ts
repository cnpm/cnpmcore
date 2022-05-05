import crypto from 'crypto';
import base from 'base-x';
import { crc32 } from '@node-rs/crc32';
import * as ssri from 'ssri';

const words = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$';
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
    return crcBytes.readUInt32BE(0) === crc32(bytes);
  } catch {
    return false;
  }
}

export function integrity(plain: string): string {
  return ssri.create().update(plain).digest()
    .toString();
}

export function checkIntegrity(plain: string, expectedIntegrity: string): boolean {
  return ssri.checkData(plain, expectedIntegrity);
}

export function sha512(plain: string): string {
  return crypto.createHash('sha512').update(plain).digest('hex');
}

// https://stackoverflow.com/questions/9719570/generate-random-password-string-with-requirements-in-javascript
export function randomPassword(length = 10): string {
  return Array.from(crypto.randomFillSync(new Uint32Array(length)))
    .map(x => words[x % words.length])
    .join('');
}
