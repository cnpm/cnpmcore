import { Attribute, Model } from '@eggjs/tegg/orm';
import { DataTypes, Bone } from 'leoric';

@Model()
export class Dist extends Bone {
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
  distId: string;

  @Attribute(DataTypes.STRING(100))
  name: string;

  @Attribute(DataTypes.STRING(512))
  path: string;

  @Attribute(DataTypes.INTEGER(11).UNSIGNED)
  size: number;

  @Attribute(DataTypes.STRING(512))
  shasum: string;

  @Attribute(DataTypes.STRING(512))
  integrity: string;
}
