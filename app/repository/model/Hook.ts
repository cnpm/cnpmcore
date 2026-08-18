import { Attribute, Model } from 'egg/orm';

import type { HookType } from '../../common/enum/Hook.ts';
import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Hook extends Bone {
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
  declare hookId: string;

  @Attribute(DataTypes.STRING(20))
  declare type: HookType;

  @Attribute(DataTypes.STRING(24))
  declare ownerId: string;

  @Attribute(DataTypes.STRING(428))
  declare name: string;

  @Attribute(DataTypes.STRING(2048))
  declare endpoint: string;

  @Attribute(DataTypes.STRING(200))
  declare secret: string;

  @Attribute(DataTypes.STRING(24), {
    allowNull: true,
  })
  declare latestTaskId: string;

  @Attribute(DataTypes.BOOLEAN)
  declare enable: boolean;
}
