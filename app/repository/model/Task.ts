import { Attribute, Model } from '@eggjs/tegg-orm-decorator';
import { DataTypes, Bone } from 'leoric';

@Model()
export class Task extends Bone {
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
  taskId: string;

  @Attribute(DataTypes.STRING(20))
  type: string;

  @Attribute(DataTypes.STRING(20))
  state: string;

  @Attribute(DataTypes.STRING(24))
  authorId: string;

  @Attribute(DataTypes.STRING(100))
  authorIp: string;

  @Attribute(DataTypes.JSONB)
  data: object;

  @Attribute(DataTypes.STRING(512))
  logPath: string;
  
  @Attribute(DataTypes.INTEGER)
  attempts: number;
}
