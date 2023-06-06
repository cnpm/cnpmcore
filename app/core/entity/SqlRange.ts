import { Range, Comparator } from 'semver';
import { PaddingSemVer } from './PaddingSemVer';

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
    if (comparator.semver === (Comparator as any).ANY) {
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
    const operator = OPERATOR_MAP[comparator.operator];
    if (!operator) {
      throw new Error(`unknown operator ${comparator.operator}`);
    }
    this._containPreRelease = this._containPreRelease || paddingSemver.isPreRelease;
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

  private comparatorSetToSql(comparatorSet: Array<Comparator>) {
    const condition: Array<object> = [];
    for (const comparator of comparatorSet) {
      condition.push(this.comparatorToSql(comparator));
    }
    return { $and: condition };
  }

  private generateWhere() {
    const conditions: Array<object> = [];
    for (const rangeSet of this.range.set) {
      conditions.push(this.comparatorSetToSql(rangeSet as Comparator[]));
    }
    return { $or: conditions };
  }

  get containPreRelease(): boolean {
    return this._containPreRelease;
  }
}
