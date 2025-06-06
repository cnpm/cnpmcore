import assert from 'node:assert/strict';

import { EntityUtil } from '../../../app/core/util/EntityUtil.js';

describe('test/core/util/EntityUtil.test.ts', () => {
  describe('convertPageOptionsToLimitOption', () => {
    it('should work', async () => {
      const res = EntityUtil.convertPageOptionsToLimitOption({
        pageIndex: 1,
        pageSize: 10,
      });
      assert.ok(res.limit === 10);
      assert.ok(res.offset === 10);
    });

    it('should work for default value', async () => {
      const res = EntityUtil.convertPageOptionsToLimitOption({});
      assert.ok(res.limit === 20);
      assert.ok(res.offset === 0);
    });

    it('should validate params', async () => {
      assert.throws(() => {
        EntityUtil.convertPageOptionsToLimitOption({
          pageIndex: 1,
          pageSize: 101,
        });
      }, /max page size is 100, current request is 101/);
    });
  });
});
