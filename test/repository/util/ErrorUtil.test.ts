import assert from 'node:assert/strict';

import { isDuplicateKeyError } from '../../../app/repository/util/ErrorUtil.ts';

describe('test/repository/util/ErrorUtil.test.ts', () => {
  describe('isDuplicateKeyError()', () => {
    it('should return true for MySQL duplicate key error', () => {
      const err = new Error('Duplicate entry') as Error & { code: string };
      err.code = 'ER_DUP_ENTRY';
      assert.equal(isDuplicateKeyError(err), true);
    });

    it('should return true for PostgreSQL duplicate key error', () => {
      const err = new Error('duplicate key value violates unique constraint "tasks_uk_task_id"');
      assert.equal(isDuplicateKeyError(err), true);
    });

    it('should return undefined for non-duplicate key error', () => {
      const err = new Error('some other error');
      assert.equal(isDuplicateKeyError(err), undefined);
    });
  });
});
