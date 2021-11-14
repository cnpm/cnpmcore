import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
// TODO leoric typing add DataTypes
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DataTypes, Bone } from 'leoric';

@Model()
export class PackageTag extends Bone {
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
  packageTagId: string;

  @Attribute(DataTypes.STRING(214))
  tag: string;

  // https://docs.npmjs.com/cli/v6/using-npm/semver#coercion
  // up to the max permitted length (256 characters)
  @Attribute(DataTypes.STRING(256))
  version: string;
}
