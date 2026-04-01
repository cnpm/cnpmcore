import { Attribute, Model } from 'egg/orm';

import { DataTypes, Bone } from '../util/leoric.ts';

@Model()
export class TeamPackage extends Bone {
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
  teamPackageId: string;

  @Attribute(DataTypes.STRING(24))
  teamId: string;

  @Attribute(DataTypes.STRING(24))
  packageId: string;
}
