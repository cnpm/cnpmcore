import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';

@Model()
export class PackageVersionBlock extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  packageId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  packageVersionBlockId: string;

  @Attribute(DataTypes.STRING(256))
  version: string;

  @Attribute(DataTypes.TEXT('long'))
  reason: string;
}
