import assert from 'assert';
import { SqlRange } from '../../../app/core/entity/SqlRange';

describe('test/npm/core/entity/SqlRange.test.ts', () => {
  it('should support compose range', () => {
    const res = new SqlRange('^0.5.0 || 0.6.0-alpha.5');
    assert.equal(res.containPreRelease, true);
    assert.deepEqual(res.condition, {
      $or: [
        {
          $and: [
            {
              $and: [
                {
                  isPreRelease: {
                    $lte: 0,
                  },
                },
                {
                  paddingVersion: {
                    $gte: '000000000000000000000000000000050000000000000000',
                  },
                },
              ],
            },
            {
              $and: [
                {
                  isPreRelease: {
                    $lte: 1,
                  },
                },
                {
                  paddingVersion: {
                    $lt: '000000000000000000000000000000060000000000000000',
                  },
                },
              ],
            },
          ],
        },
        {
          $and: [
            {
              $and: [
                {
                  isPreRelease: {
                    $lte: 1,
                  },
                },
                {
                  paddingVersion: {
                    $eq: '000000000000000000000000000000060000000000000000',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });
  it('should support =', () => {
    const res = new SqlRange('1.0.0 || 2.0.0');
    assert(res.containPreRelease === false);
    assert.deepEqual(res.condition, {
      $or: [
        {
          $and: [
            {
              $and: [
                {
                  isPreRelease: {
                    $lte: 0,
                  },
                },
                {
                  paddingVersion: {
                    $eq: '000000000000000100000000000000000000000000000000',
                  },
                },
              ],
            },
          ],
        },
        {
          $and: [
            {
              $and: [
                {
                  isPreRelease: {
                    $lte: 0,
                  },
                },
                {
                  paddingVersion: {
                    $eq: '000000000000000200000000000000000000000000000000',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
