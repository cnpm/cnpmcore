import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class Scope extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(214))
  name: string;

  @Attribute(DataTypes.STRING(256))
  registryId: string;

  @Attribute(DataTypes.STRING(256))
  scopeId: string;
}
