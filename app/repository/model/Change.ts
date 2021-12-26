import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';

@Model()
export class Change extends Bone {
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
  changeId: string;

  @Attribute(DataTypes.STRING(50))
  type: string;

  @Attribute(DataTypes.STRING(214))
  targetName: string;

  @Attribute(DataTypes.JSONB)
  data: any;
}
