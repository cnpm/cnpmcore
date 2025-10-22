import { Attribute, Model } from '@eggjs/tegg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';
import { EntityProperty } from '../util/EntityProperty.ts';

@Model()
export class Package extends Bone {
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
  packageId: string;

  @Attribute(DataTypes.STRING(24))
  registryId: string;

  @Attribute(DataTypes.STRING(214))
  scope: string;

  // https://github.com/npm/npm/issues/8077#issuecomment-97258418
  // https://docs.npmjs.com/cli/v7/configuring-npm/package-json#name
  // The name must be less than or equal to 214 characters. This includes the scope for scoped packages.
  @Attribute(DataTypes.STRING(214))
  name: string;

  // cnpm private package or not, `false` meaning is the npm public registry package
  @Attribute(DataTypes.BOOLEAN)
  isPrivate: boolean;

  @Attribute(DataTypes.STRING(10_240))
  description: string;

  // store all abbreviated manifests into Dist store
  @EntityProperty('abbreviatedsDist.distId')
  @Attribute(DataTypes.STRING(24), { allowNull: true })
  abbreviatedsDistId: string;

  // store all full manifests into Dist store
  @EntityProperty('manifestsDist.distId')
  @Attribute(DataTypes.STRING(24), { allowNull: true })
  manifestsDistId: string;
}
