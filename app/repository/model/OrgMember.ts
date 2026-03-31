import { Attribute, Model } from 'egg/orm';
import { DataTypes, Bone } from 'leoric';

@Model()
export class OrgMember extends Bone {
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
  orgMemberId: string;

  @Attribute(DataTypes.STRING(24))
  orgId: string;

  @Attribute(DataTypes.STRING(24))
  userId: string;

  @Attribute(DataTypes.STRING(20))
  role: string;
}
