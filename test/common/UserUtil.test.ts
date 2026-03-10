import assert from 'node:assert/strict';

import { getBrowserTypeForWebauthn, getUAInfo, randomToken, sha512 } from '../../app/common/UserUtil.ts';

describe('test/common/UserUtil.test.ts', () => {
  describe('randomToken()', () => {
    it('should work', () => {
      for (let i = 0; i < 2000; i++) {
        const token = randomToken('cnpm');
        assert.match(token, /cnpm_\w{31,33}_\w{4,6}/);
      }
    });
  });

  describe('sha512()', () => {
    it('should hash string', () => {
      const hash = sha512('hello');
      assert.equal(hash.length, 128);
      assert.equal(hash, sha512('hello'));
      assert.notEqual(hash, sha512('world'));
    });
  });

  describe('getUAInfo()', () => {
    it('should return null for empty user agent', () => {
      assert.equal(getUAInfo(), null);
      assert.equal(getUAInfo(undefined), null);
      assert.equal(getUAInfo(''), null);
    });

    it('should parse user agent string', () => {
      const ua = getUAInfo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      assert.ok(ua);
      assert.equal(ua.getBrowser().name, 'Chrome');
    });
  });

  describe('getBrowserTypeForWebauthn()', () => {
    it('should return null for empty user agent', () => {
      assert.equal(getBrowserTypeForWebauthn(), null);
      assert.equal(getBrowserTypeForWebauthn(undefined), null);
    });

    it('should return mobile for iOS', () => {
      assert.equal(
        getBrowserTypeForWebauthn(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        ),
        'mobile',
      );
    });

    it('should return mobile for Android', () => {
      assert.equal(
        getBrowserTypeForWebauthn(
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        ),
        'mobile',
      );
    });

    it('should return null for desktop OS (macOS/Windows)', () => {
      // macOS Chrome — os.name is 'macOS' (not 'Mac OS'), so returns null
      assert.equal(
        getBrowserTypeForWebauthn(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ),
        null,
      );
      // Windows Chrome
      assert.equal(
        getBrowserTypeForWebauthn(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ),
        null,
      );
    });
  });
});
