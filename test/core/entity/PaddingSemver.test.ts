import assert from 'node:assert/strict';

import { PaddingSemVer } from '../../../app/core/entity/PaddingSemVer.ts';

describe('test/core/entity/PaddingSemver.test.ts', () => {
  it('should parse 16 length version ok', () => {
    // http://npmjs.com/package/npm-test-playground
    const version = new PaddingSemVer('0.9007199254740991.0');
    assert.equal(version.paddingVersion, '000000000000000090071992547409910000000000000000');
  });

  describe('constructor', () => {
    it('should handle valid stable version', () => {
      const psv = new PaddingSemVer('1.2.3');
      assert.equal(psv.isPreRelease, false);
      assert.equal(psv.paddingVersion, '000000000000000100000000000000020000000000000003');
    });

    it('should handle prerelease version', () => {
      const psv = new PaddingSemVer('1.0.0-beta.1');
      assert.equal(psv.isPreRelease, true);
    });

    it('should handle invalid version', () => {
      const psv = new PaddingSemVer('1000000000000000000.0.0');
      assert.equal(psv.isPreRelease, true);
      assert.equal(psv.paddingVersion, PaddingSemVer.anyVersion());
    });

    it('should handle version 0.0.0', () => {
      const psv = new PaddingSemVer('0.0.0');
      assert.equal(psv.isPreRelease, false);
      assert.equal(psv.paddingVersion, '000000000000000000000000000000000000000000000000');
    });

    it('should handle large version numbers', () => {
      const psv = new PaddingSemVer('999.888.777');
      assert.equal(psv.isPreRelease, false);
      assert.equal(psv.paddingVersion.length, 48);
    });
  });

  describe('paddingVersion()', () => {
    it('should pad single digits', () => {
      assert.equal(PaddingSemVer.paddingVersion(0), '0000000000000000');
      assert.equal(PaddingSemVer.paddingVersion(1), '0000000000000001');
      assert.equal(PaddingSemVer.paddingVersion(9), '0000000000000009');
    });

    it('should pad multi-digit numbers', () => {
      assert.equal(PaddingSemVer.paddingVersion(123), '0000000000000123');
      assert.equal(PaddingSemVer.paddingVersion(999999), '0000000000999999');
    });

    it('should handle 16-digit number', () => {
      assert.equal(PaddingSemVer.paddingVersion(1234567890123456), '1234567890123456');
    });

    it('should throw for number exceeding 16 digits', () => {
      assert.throws(() => {
        // 1e17 = 100000000000000000 (18 digits), exceeds the 16-char padding limit
        PaddingSemVer.paddingVersion(1e17);
      }, /too long/);
    });
  });

  describe('anyVersion()', () => {
    it('should return 48-char zero string', () => {
      const any = PaddingSemVer.anyVersion();
      assert.equal(any.length, 48);
      assert.equal(any, '0'.repeat(48));
    });
  });
});
