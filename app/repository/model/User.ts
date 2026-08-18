import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class User extends Bone {
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
  declare userId: string;

  @Attribute(DataTypes.STRING(100))
  declare name: string;

  @Attribute(DataTypes.STRING(400))
  declare email: string;

  @Attribute(DataTypes.STRING(100))
  declare passwordSalt: string;

  @Attribute(DataTypes.STRING(512))
  declare passwordIntegrity: string;

  @Attribute(DataTypes.STRING(100))
  declare ip: string;

  // cnpm private user or not, `false` meaning is the npm public registry user
  @Attribute(DataTypes.BOOLEAN)
  declare isPrivate: boolean;

  @Attribute(DataTypes.JSONB, { allowNull: true })
  declare scopes: string[];
}
