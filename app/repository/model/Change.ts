import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Change extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  changeId: string;

  @Attribute(DataTypes.STRING(50))
  type: string;

  @Attribute(DataTypes.STRING(214))
  targetName: string;

  @Attribute(DataTypes.JSONB)
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  data: any;
}
