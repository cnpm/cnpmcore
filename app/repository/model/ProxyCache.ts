import { Attribute, Model } from 'egg/orm';

import type { DIST_NAMES } from '../../core/entity/Package.ts';
import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class ProxyCache extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(214))
  declare fullname: string;

  @Attribute(DataTypes.STRING(30))
  declare fileType: DIST_NAMES;

  @Attribute(DataTypes.STRING(512), {
    unique: true,
  })
  declare filePath: string;

  @Attribute(DataTypes.STRING(214))
  declare version?: string;
}
