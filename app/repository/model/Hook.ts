import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';
import { HookType } from '../../core/entity/Hook';

@Model()
export class Hook extends Bone {
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
  hookId: string;

  @Attribute(DataTypes.STRING(20))
  type: HookType;

  @Attribute(DataTypes.STRING(24))
  ownerId: string;

  @Attribute(DataTypes.STRING(428))
  name: string;

  @Attribute(DataTypes.STRING(2048))
  endpoint: string;

  @Attribute(DataTypes.STRING(200))
  secret: string;

  @Attribute(DataTypes.STRING(24), {
    allowNull: true,
  })
  latestTaskId: string;

  @Attribute(DataTypes.BOOLEAN)
  enable: boolean;
}
