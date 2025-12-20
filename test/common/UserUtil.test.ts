import assert from 'node:assert/strict';

import { randomToken } from '../../app/common/UserUtil.ts';

describe('test/common/UserUtil.test.ts', () => {
  describe('randomToken()', () => {
    it('should work', () => {
      for (let i = 0; i < 2000; i++) {
        const token = randomToken('cnpm');
        assert.match(token, /cnpm_\w{31,33}_\w{4,6}/);
      }
    });
  });
});
