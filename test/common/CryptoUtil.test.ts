import { strict as assert } from 'node:assert';
import { genRSAKeys, encryptRSA, decryptRSA } from '../../app/common/CryptoUtil';

describe('test/common/CryptoUtil.test.ts', () => {
  describe('genRSAKeys()', () => {
    it('should work', () => {
      const keys = genRSAKeys();
      assert(keys.publicKey);
      assert(keys.privateKey);
    });
  });

  describe('encryptRSA(), decryptRSA()', () => {
    it('should work', () => {
      const keys = genRSAKeys();
      // const plainText = 'hello world 中文😄';
      const plainText = 'hello world 中文';
      const encryptText = encryptRSA(keys.publicKey, plainText);
      // console.log(encryptText);
      assert.equal(decryptRSA(keys.privateKey, encryptText), plainText);
    });
  });
});
