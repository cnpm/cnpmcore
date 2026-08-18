import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes, LENGTH_VARIANTS } from '../util/leoric.ts';

@Model()
export class PackageVersionBlock extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  declare packageId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  declare packageVersionBlockId: string;

  @Attribute(DataTypes.STRING(256))
  declare version: string;

  @Attribute(DataTypes.TEXT(LENGTH_VARIANTS.long))
  declare reason: string;

  // dependency isolation: 'buffer' = isolation buffer record (auto-releasable),
  // null = permanent block (existing semantics: security / manual / blacklist)
  @Attribute(DataTypes.STRING(16), { allowNull: true })
  declare type: string | null;

  // dependency isolation: buffer expiration time; auto-released after this when type='buffer'
  @Attribute(DataTypes.DATE, { allowNull: true })
  declare expiredAt: Date | null;
}
