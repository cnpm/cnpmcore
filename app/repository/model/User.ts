import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';

@Model()
export class User extends Bone {
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
  userId: string;

  @Attribute(DataTypes.STRING(100))
  name: string;

  @Attribute(DataTypes.STRING(400))
  email: string;

  @Attribute(DataTypes.STRING(100))
  passwordSalt: string;

  @Attribute(DataTypes.STRING(512))
  passwordIntegrity: string;

  @Attribute(DataTypes.STRING(100))
  ip: string;

  // cnpm private user or not, `false` meaning is the npm public registry user
  @Attribute(DataTypes.BOOLEAN)
  isPrivate: boolean;

  @Attribute(DataTypes.JSONB, { allowNull: true })
  scopes: string[];
}
