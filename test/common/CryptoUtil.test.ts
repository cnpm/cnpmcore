import assert from 'node:assert/strict';

import { decryptRSA, encryptRSA, genRSAKeys } from '../../app/common/CryptoUtil.ts';

describe('test/common/CryptoUtil.test.ts', () => {
  describe('genRSAKeys()', () => {
    it('should work', () => {
      const keys = genRSAKeys();
      assert.ok(keys.publicKey);
      assert.ok(keys.privateKey);
    });
  });

  describe('encryptRSA(), decryptRSA()', () => {
    it('should work', () => {
      const keys = genRSAKeys();
      // const plainText = 'hello world 中文😄';
      const plainText = 'hello world 中文';
      const encryptText = encryptRSA(keys.publicKey, plainText);
      assert.equal(decryptRSA(keys.privateKey, encryptText), plainText);
    });
  });
});
