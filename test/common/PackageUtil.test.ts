import { strict as assert } from 'assert';
import { formatTarball } from 'app/common/PackageUtil';

describe('test/common/PackageUtil.test.ts', () => {
  describe('formatTarball()', () => {
    it('should work', () => {
      assert.equal(formatTarball('https://r.cnpmjs.org', 'foo', '1.0.0'), 'https://r.cnpmjs.org/foo/-/foo-1.0.0.tgz');
      assert.equal(formatTarball('https://r.cnpmjs.org', '@bar/foo', '1.0.0'), 'https://r.cnpmjs.org/@bar/foo/-/foo-1.0.0.tgz');
    });
  });
});
