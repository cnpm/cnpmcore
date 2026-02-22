import assert from 'node:assert/strict';

import { PaddingSemVer } from '../../../app/core/entity/PaddingSemVer.ts';

describe('test/core/entity/PaddingSemver.test.ts', () => {
  it('should parse 16 length version ok', () => {
    // http://npmjs.com/package/npm-test-playground
    const version = new PaddingSemVer('0.9007199254740991.0');
    assert.equal(version.paddingVersion, '000000000000000090071992547409910000000000000000');
  });
});
