import { Attribute, Model } from 'egg/orm';

import { DataTypes, Bone } from '../util/leoric.ts';

@Model()
export class Team extends Bone {
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
  declare teamId: string;

  @Attribute(DataTypes.STRING(24))
  declare orgId: string;

  @Attribute(DataTypes.STRING(214))
  declare name: string;

  @Attribute(DataTypes.STRING(10240), { allowNull: true })
  declare description: string;
}
