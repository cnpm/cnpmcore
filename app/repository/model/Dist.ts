import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Dist extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  declare distId: string;

  @Attribute(DataTypes.STRING(100))
  declare name: string;

  @Attribute(DataTypes.STRING(512))
  declare path: string;

  @Attribute(DataTypes.INTEGER(11).UNSIGNED)
  declare size: number;

  @Attribute(DataTypes.STRING(512))
  declare shasum: string;

  @Attribute(DataTypes.STRING(512))
  declare integrity: string;
}
