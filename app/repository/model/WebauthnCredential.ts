import { Attribute, Model } from '@eggjs/tegg/orm';
import { DataTypes, Bone } from 'leoric';

@Model()
export class WebauthnCredential extends Bone {
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
  wancId: string;

  @Attribute(DataTypes.STRING(24))
  userId: string;

  @Attribute(DataTypes.STRING(200))
  credentialId: string;

  @Attribute(DataTypes.STRING(512))
  publicKey: string;

  @Attribute(DataTypes.STRING(24), { allowNull: true })
  browserType: string;
}
