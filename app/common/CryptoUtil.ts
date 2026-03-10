import { generateKeyPairSync } from 'node:crypto';

import NodeRSA from 'node-rsa';

// generate rsa key pair
export function genRSAKeys(): { publicKey: string; privateKey: string } {
  const key = generateKeyPairSync('rsa', {
    modulusLength: 512,
  });
  // export({ format: 'pem' }) returns string; .toString('base64') is a no-op on string.
  // Use type assertion to fix TS2554 on Node 18 type definitions.
  const publicKey = key.publicKey.export({
    type: 'pkcs1',
    format: 'pem',
  }) as string;
  const privateKey = key.privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }) as string;
  return { publicKey, privateKey };
}

// encrypt rsa private key
export function encryptRSA(publicKey: string, plainText: string): string {
  const key = new NodeRSA(publicKey, 'pkcs1-public-pem', {
    encryptionScheme: 'pkcs1',
    environment: 'browser',
  });
  return key.encrypt(plainText, 'base64');
}

// decrypt rsa private key
export function decryptRSA(privateKey: string, encryptedBase64: string): string {
  const key = new NodeRSA(privateKey, 'pkcs1-private-pem', {
    encryptionScheme: 'pkcs1',
    environment: 'browser',
  });
  return key.decrypt(encryptedBase64, 'utf8');
}
