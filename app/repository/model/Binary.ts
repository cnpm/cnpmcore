import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Binary extends Bone {
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
  declare binaryId: string;

  @Attribute(DataTypes.STRING(50))
  declare category: string;

  @Attribute(DataTypes.STRING(700))
  declare parent: string;

  @Attribute(DataTypes.STRING(200))
  declare name: string;

  @Attribute(DataTypes.BOOLEAN)
  declare isDir: boolean;

  @Attribute(DataTypes.INTEGER(11).UNSIGNED)
  declare size: number;

  @Attribute(DataTypes.STRING(100))
  declare date: string;
}
