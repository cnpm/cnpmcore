import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Token extends Bone {
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
  declare tokenId: string;

  @Attribute(DataTypes.STRING(20))
  declare tokenMark: string;

  @Attribute(DataTypes.STRING(200), {
    unique: true,
  })
  declare tokenKey: string;

  @Attribute(DataTypes.STRING(24))
  declare userId: string;

  @Attribute(DataTypes.JSONB)
  declare cidrWhitelist: string[];

  @Attribute(DataTypes.BOOLEAN)
  declare isReadonly: boolean;

  @Attribute(DataTypes.BOOLEAN)
  declare isAutomation: boolean;

  @Attribute(DataTypes.STRING(255))
  declare type: string;

  @Attribute(DataTypes.STRING(255))
  declare name: string;

  @Attribute(DataTypes.STRING(255))
  declare description: string;

  @Attribute(DataTypes.JSONB)
  declare allowedScopes: string[];

  @Attribute(DataTypes.DATE)
  declare expiredAt: Date;

  @Attribute(DataTypes.DATE)
  declare lastUsedAt: Date;
}
