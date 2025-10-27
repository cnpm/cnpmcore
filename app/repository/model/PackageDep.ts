import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageDep extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  packageVersionId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  packageDepId: string;

  @Attribute(DataTypes.STRING(214))
  scope: string;

  @Attribute(DataTypes.STRING(214))
  name: string;

  @Attribute(DataTypes.STRING(100))
  spec: string;
}
