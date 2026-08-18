import { Attribute, Model } from 'egg/orm';

import type { RegistryType } from '../../common/enum/Registry.ts';
import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Registry extends Bone {
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
  declare registryId: string;

  @Attribute(DataTypes.STRING(256))
  declare name: string;

  @Attribute(DataTypes.STRING(4096))
  declare host: string;

  @Attribute(DataTypes.STRING(4096), { name: 'change_stream' })
  declare changeStream: string;

  @Attribute(DataTypes.STRING(4096), { name: 'user_prefix' })
  declare userPrefix: string;

  @Attribute(DataTypes.STRING(256))
  declare type: RegistryType;

  @Attribute(DataTypes.STRING(256), { name: 'auth_token' })
  declare authToken?: string;
}
