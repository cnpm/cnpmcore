import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageDep extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  declare packageVersionId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  declare packageDepId: string;

  @Attribute(DataTypes.STRING(214))
  declare scope: string;

  @Attribute(DataTypes.STRING(214))
  declare name: string;

  @Attribute(DataTypes.STRING(100))
  declare spec: string;
}
