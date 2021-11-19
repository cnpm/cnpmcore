import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
// TODO leoric typing add DataTypes
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DataTypes, Bone } from 'leoric';

@Model()
export class Dist extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE)
  gmtCreate: Date;

  @Attribute(DataTypes.DATE)
  gmtModified: Date;

  @Attribute(DataTypes.STRING(24))
  distId: string;

  @Attribute(DataTypes.STRING(100))
  name: string;

  @Attribute(DataTypes.STRING(512))
  path: string;

  @Attribute(DataTypes.INTEGER(10))
  size: number;

  @Attribute(DataTypes.STRING(512))
  shasum: string;

  @Attribute(DataTypes.STRING(512))
  integrity: string;
}
