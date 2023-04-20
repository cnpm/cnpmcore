import { Attribute, Model } from '@eggjs/tegg/orm';
import { DataTypes, Bone } from 'leoric';

@Model()
export class TokenPackage extends Bone {
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
  tokenId: string;

  @Attribute(DataTypes.STRING(24))
  packageId: string;
}
