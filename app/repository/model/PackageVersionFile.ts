import { Attribute, Model } from '@eggjs/tegg/orm';

import { Bone, DataTypes } from '../util/leoric.js';
import { EntityProperty } from '../util/EntityProperty.js';

@Model()
export class PackageVersionFile extends Bone {
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
  packageVersionFileId: string;

  @Attribute(DataTypes.STRING(24))
  packageVersionId: string;

  @Attribute(DataTypes.STRING(500))
  directory: string;

  @Attribute(DataTypes.STRING(200))
  name: string;

  @Attribute(DataTypes.STRING(200))
  contentType: string;

  @EntityProperty('dist.distId')
  @Attribute(DataTypes.STRING(24))
  distId: string;

  @Attribute(DataTypes.DATE)
  mtime: Date;
}
