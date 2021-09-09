import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
// TODO leoric typing add DataTypes
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DataTypes, Bone } from 'leoric';

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

  @Attribute(DataTypes.STRING(214))
  name: string;

  @Attribute(DataTypes.BOOLEAN)
  isPrivate: boolean;
}
