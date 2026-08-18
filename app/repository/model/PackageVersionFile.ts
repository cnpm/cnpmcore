import { Attribute, Model } from 'egg/orm';

import { EntityProperty } from '../util/EntityProperty.ts';
import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageVersionFile extends Bone {
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
  declare packageVersionFileId: string;

  @Attribute(DataTypes.STRING(24))
  declare packageVersionId: string;

  @Attribute(DataTypes.STRING(500))
  declare directory: string;

  @Attribute(DataTypes.STRING(200))
  declare name: string;

  @Attribute(DataTypes.STRING(200))
  declare contentType: string;

  @EntityProperty('dist.distId')
  @Attribute(DataTypes.STRING(24))
  declare distId: string;

  @Attribute(DataTypes.DATE)
  declare mtime: Date;
}
