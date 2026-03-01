import assert from 'node:assert/strict';

import { isTimeoutError } from '../../app/common/ErrorUtil.ts';

describe('test/common/ErrorUtil.test.ts', () => {
  describe('isTimeoutError()', () => {
    const timeoutErrorNames = [
      'HttpClientRequestTimeoutError',
      'HttpClientConnectTimeoutError',
      'ConnectionError',
      'ConnectTimeoutError',
      'BodyTimeoutError',
      'ResponseTimeoutError',
    ];

    for (const errorName of timeoutErrorNames) {
      it(`should return true for ${errorName}`, () => {
        const err = new Error('timeout');
        err.name = errorName;
        assert.equal(isTimeoutError(err), true);
      });
    }

    it('should return false for non-timeout error', () => {
      const err = new Error('some error');
      assert.equal(isTimeoutError(err), false);
    });

    it('should return true for AggregateError with timeout sub-error', () => {
      const subError = new Error('timeout');
      subError.name = 'ConnectTimeoutError';
      const err = new AggregateError([subError], 'aggregate');
      assert.equal(isTimeoutError(err), true);
    });

    it('should return false for AggregateError without timeout sub-error', () => {
      const subError = new Error('not timeout');
      const err = new AggregateError([subError], 'aggregate');
      assert.equal(isTimeoutError(err), false);
    });

    it('should return true for error with timeout cause', () => {
      const cause = new Error('timeout');
      cause.name = 'BodyTimeoutError';
      const err = new Error('wrapper');
      (err as any).cause = cause;
      assert.equal(isTimeoutError(err), true);
    });

    it('should return false for error with non-timeout cause', () => {
      const cause = new Error('not timeout');
      const err = new Error('wrapper');
      (err as any).cause = cause;
      assert.equal(isTimeoutError(err), false);
    });
  });
});
