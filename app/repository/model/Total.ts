import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Total extends Bone {
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
  type: string;

  @Attribute(DataTypes.BIGINT)
  count: bigint;
}
