import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';

@Model()
export class Token extends Bone {
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
  tokenId: string;

  @Attribute(DataTypes.STRING(20))
  tokenMark: string;

  @Attribute(DataTypes.STRING(200), {
    unique: true,
  })
  tokenKey: string;

  @Attribute(DataTypes.STRING(24))
  userId: string;

  @Attribute(DataTypes.JSONB)
  cidrWhitelist: string[];

  @Attribute(DataTypes.BOOLEAN)
  isReadonly: boolean;

  @Attribute(DataTypes.BOOLEAN)
  isAutomation: boolean;
}
