import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class WebauthnCredential extends Bone {
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
  declare wancId: string;

  @Attribute(DataTypes.STRING(24))
  declare userId: string;

  @Attribute(DataTypes.STRING(200))
  declare credentialId: string;

  @Attribute(DataTypes.STRING(512))
  declare publicKey: string;

  @Attribute(DataTypes.STRING(24), { allowNull: true })
  declare browserType: string;
}
