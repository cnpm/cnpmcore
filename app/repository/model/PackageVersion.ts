import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
// TODO leoric typing add DataTypes
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DataTypes, Bone } from 'leoric';
import { EntityProperty } from '../util/EntityProperty';

@Model()
export class PackageVersion extends Bone {
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

  @Attribute(DataTypes.STRING(24))
  packageVersionId: string;

  // https://docs.npmjs.com/cli/v6/using-npm/semver#coercion
  // up to the max permitted length (256 characters)
  @Attribute(DataTypes.STRING(256))
  version: string;

  @EntityProperty('abbreviatedDist.distId')
  @Attribute(DataTypes.STRING(24))
  abbreviatedDistId: string;

  @EntityProperty('manifestDist.distId')
  @Attribute(DataTypes.STRING(24))
  manifestDistId: string;

  @EntityProperty('tarDist.distId')
  @Attribute(DataTypes.STRING(24))
  tarDistId: string;

  @EntityProperty('readmeDist.distId')
  @Attribute(DataTypes.STRING(24))
  readmeDistId: string;

  @Attribute(DataTypes.DATE)
  publishTime: Date;
}
