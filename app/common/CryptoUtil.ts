import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from 'crypto';

// generate rsa key pair
export function genRSAKeys(): { publicKey: string, privateKey: string } {
  const key = generateKeyPairSync('rsa', {
    modulusLength: 512,
  });
  const publicKey = key.publicKey.export({
    type: 'pkcs1',
    format: 'pem',
  }).toString('base64');
  const privateKey = key.privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }).toString('base64');
  return { publicKey, privateKey };
}

// encrypt rsa private key
export function encryptRSA(publicKey: string, data: string): string {
  return publicEncrypt({
    key: publicKey,
    padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(data, 'utf8')).toString('base64');
}

// decrypt rsa private key
export function decryptRSA(privateKey: string, data: string) {
  return privateDecrypt({
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(data, 'base64')).toString('utf8');
}
