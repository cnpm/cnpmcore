import NodeRSA from 'node-rsa';

// generate rsa key pair
export function genRSAKeys(): { publicKey: string, privateKey: string } {
  const key = new NodeRSA({ b: 512 });
  key.setOptions({ encryptionScheme: 'pkcs1' });
  const publicKey = key.exportKey('pkcs8-public');
  const privateKey = key.exportKey('pkcs8-private');
  return { publicKey, privateKey };
}

// encrypt rsa private key
export function encryptRSA(publicKey: string, data: string): string {
  const pubKey = new NodeRSA(publicKey, 'pkcs8-public');
  pubKey.setOptions({ encryptionScheme: 'pkcs1' });
  return pubKey.encrypt(data, 'base64');
}

// decrypt rsa private key
export function decryptRSA(privateKey: string, data: string): string {
  const priKey = new NodeRSA(privateKey, 'pkcs8-private');
  priKey.setOptions({ encryptionScheme: 'pkcs1' });
  return priKey.decrypt(Buffer.from(data, 'base64'), 'utf8');
}
