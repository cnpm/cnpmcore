import { Comparator, Range } from 'semver';
import { PaddingSemVer } from './PaddingSemVer.js';

const OPERATOR_MAP = {
  '<': '$lt',
  '<=': '$lte',
  '>': '$gt',
  '>=': '$gte',
  '': '$eq',
};

export class SqlRange {
  private readonly range: Range;
  private _containPreRelease: boolean;
  readonly condition: object;

  constructor(range: string | Range) {
    this.range = new Range(range);
    this._containPreRelease = false;
    this.condition = this.generateWhere();
  }

  private comparatorToSql(comparator: Comparator) {
    // @ts-expect-error type definition is not correct
    if (comparator.semver === Comparator.ANY) {
      return {
        $and: [
          {
            isPreRelease: {
              $lte: 0,
            },
          },
          {
            paddingVersion: {
              $gte: PaddingSemVer.anyVersion(),
            },
          },
        ],
      };
    }
    const paddingSemver = new PaddingSemVer(comparator.semver);
    const operator =
      OPERATOR_MAP[comparator.operator as keyof typeof OPERATOR_MAP];
    if (!operator) {
      throw new Error(`unknown operator ${comparator.operator}`);
    }
    this._containPreRelease =
      this._containPreRelease || paddingSemver.isPreRelease;
    return {
      $and: [
        {
          isPreRelease: {
            $lte: paddingSemver.isPreRelease ? 1 : 0,
          },
        },
        {
          paddingVersion: {
            [operator]: paddingSemver.paddingVersion,
          },
        },
      ],
    };
  }

  private comparatorSetToSql(comparatorSet: Comparator[]) {
    const condition: object[] = [];
    for (const comparator of comparatorSet) {
      condition.push(this.comparatorToSql(comparator));
    }
    return { $and: condition };
  }

  private generateWhere() {
    const conditions: object[] = [];
    for (const rangeSet of this.range.set) {
      conditions.push(this.comparatorSetToSql(rangeSet as Comparator[]));
    }
    return { $or: conditions };
  }

  get containPreRelease(): boolean {
    return this._containPreRelease;
  }
}
