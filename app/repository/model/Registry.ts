import { Attribute, Model } from '@eggjs/tegg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';
import type { RegistryType } from '../../common/enum/Registry.ts';

@Model()
export class Registry extends Bone {
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
  registryId: string;

  @Attribute(DataTypes.STRING(256))
  name: string;

  @Attribute(DataTypes.STRING(4096))
  host: string;

  @Attribute(DataTypes.STRING(4096), { name: 'change_stream' })
  changeStream: string;

  @Attribute(DataTypes.STRING(4096), { name: 'user_prefix' })
  userPrefix: string;

  @Attribute(DataTypes.STRING(256))
  type: RegistryType;

  @Attribute(DataTypes.STRING(256), { name: 'auth_token' })
  authToken?: string;
}
