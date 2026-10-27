import assert from 'node:assert/strict';

import { FULLNAME_REG_STRING } from '../../app/common/PackageUtil.ts';

describe('test/common/PackageNameRoute.test.ts', () => {
  const fullnamePattern = new RegExp(`^(?:${FULLNAME_REG_STRING})$`);

  it('should reserve the standalone dash for registry API routes', () => {
    assert.equal(fullnamePattern.test('-'), false);
  });

  for (const fullname of ['files', 'a', 'is-number', '@cnpm/files', '@cnpm%2ffiles', '@cnpm%2Ffiles']) {
    it(`should match package name ${fullname}`, () => {
      assert.equal(fullnamePattern.test(fullname), true);
    });
  }
});
