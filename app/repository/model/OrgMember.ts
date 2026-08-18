import { Attribute, Model } from 'egg/orm';

import { DataTypes, Bone } from '../util/leoric.ts';

@Model()
export class OrgMember extends Bone {
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
  declare orgMemberId: string;

  @Attribute(DataTypes.STRING(24))
  declare orgId: string;

  @Attribute(DataTypes.STRING(24))
  declare userId: string;

  @Attribute(DataTypes.STRING(20))
  declare role: string;
}
