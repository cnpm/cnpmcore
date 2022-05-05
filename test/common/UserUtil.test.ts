import assert = require('assert');
import { randomToken, checkToken, randomPassword } from '../../app/common/UserUtil';

describe('test/common/UserUtil.test.ts', () => {
  describe('randomToken()', () => {
    it('should work', () => {
      for (let i = 0; i < 200000; i++) {
        const token = randomToken('cnpm');
        assert.match(token, /cnpm_\w{31,33}_\w{4,6}/);
        assert(checkToken(token, 'cnpm'));
        assert(!checkToken(token, 'npm'));
        assert(!checkToken(token + 'a', 'cnpm'));
      }
    });
  });

  describe('checkToken()', () => {
    it('should work', () => {
      assert(checkToken(randomToken('cnpm'), 'cnpm'));
      assert(!checkToken('', 'cnpm'));
      assert(!checkToken('cnpm__', 'cnpm'));
      assert(!checkToken('cnpm_1_2', 'npm'));
      assert(!checkToken('cnpm_1_2', 'cnpm'));
      assert(!checkToken('cnpm_1?!@#_2\\dd', 'cnpm'));
    });
  });

  describe('randomPassword()', () => {
    it('should work', () => {
      assert.equal(randomPassword().length, 10);
    });
  });
});
