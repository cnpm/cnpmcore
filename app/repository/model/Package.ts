import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
// TODO leoric typing add DataTypes
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DataTypes, Bone } from 'leoric';
import { EntityProperty } from '../util/EntityProperty';

@Model()
export class Package extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE)
  gmtCreate: Date;

  @Attribute(DataTypes.DATE)
  gmtModified: Date;

  @Attribute(DataTypes.STRING(24))
  packageId: string;

  @Attribute(DataTypes.STRING(214))
  scope?: string;

  // https://github.com/npm/npm/issues/8077#issuecomment-97258418
  // https://docs.npmjs.com/cli/v7/configuring-npm/package-json#name
  // The name must be less than or equal to 214 characters. This includes the scope for scoped packages.
  @Attribute(DataTypes.STRING(214))
  name: string;

  // cnpm private package or not, `false` meaning is the npm public registry package
  @Attribute(DataTypes.BOOLEAN)
  isPrivate: boolean;

  @Attribute(DataTypes.STRING(10240))
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
