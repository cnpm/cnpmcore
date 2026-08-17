import { Attribute, Model } from 'egg/orm';

import { PaddingSemVer } from '../../core/entity/PaddingSemVer.ts';
import { EntityProperty } from '../util/EntityProperty.ts';
import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageVersion extends Bone {
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
  declare packageVersionId: string;

  // https://docs.npmjs.com/cli/v6/using-npm/semver#coercion
  // up to the max permitted length (256 characters)
  @Attribute(DataTypes.STRING(256))
  declare version: string;

  @EntityProperty('abbreviatedDist.distId')
  @Attribute(DataTypes.STRING(24))
  declare abbreviatedDistId: string;

  @EntityProperty('manifestDist.distId')
  @Attribute(DataTypes.STRING(24))
  declare manifestDistId: string;

  @EntityProperty('tarDist.distId')
  @Attribute(DataTypes.STRING(24))
  declare tarDistId: string;

  @EntityProperty('readmeDist.distId')
  @Attribute(DataTypes.STRING(24))
  declare readmeDistId: string;

  @Attribute(DataTypes.DATE)
  declare publishTime: Date;

  @Attribute(DataTypes.STRING)
  declare paddingVersion: string;

  @Attribute(DataTypes.BOOLEAN)
  declare isPreRelease: boolean;

  static beforeCreate(instance: { version: string; paddingVersion: string; isPreRelease: boolean }) {
    if (!instance.paddingVersion) {
      const paddingSemVer = new PaddingSemVer(instance.version);
      instance.paddingVersion = paddingSemVer.paddingVersion;
      instance.isPreRelease = paddingSemVer.isPreRelease;
    }
  }
}
