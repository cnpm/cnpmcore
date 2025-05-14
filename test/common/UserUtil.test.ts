import assert from 'node:assert/strict';

import { checkToken, randomToken } from '../../app/common/UserUtil.js';

describe('test/common/UserUtil.test.ts', () => {
  describe('randomToken()', () => {
    it('should work', () => {
      for (let i = 0; i < 2000; i++) {
        const token = randomToken('cnpm');
        assert.match(token, /cnpm_\w{31,33}_\w{4,6}/);
        assert.ok(checkToken(token, 'cnpm'));
        assert.ok(!checkToken(token, 'npm'));
        assert.ok(!checkToken(token + 'a', 'cnpm'));
      }
    });
  });

  describe('checkToken()', () => {
    it('should work', () => {
      assert.ok(checkToken(randomToken('cnpm'), 'cnpm'));
      assert.ok(!checkToken('', 'cnpm'));
      assert.ok(!checkToken('cnpm__', 'cnpm'));
      assert.ok(!checkToken('cnpm_1_2', 'npm'));
      assert.ok(!checkToken('cnpm_1_2', 'cnpm'));
      assert.ok(!checkToken(String.raw`cnpm_1?!@#_2\dd`, 'cnpm'));
    });
  });
});
