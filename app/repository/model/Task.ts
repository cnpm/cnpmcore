import { Attribute, Model } from '@eggjs/tegg/orm';

import { DataTypes, Bone, LENGTH_VARIANTS } from '../util/leoric.js';
import { TaskState, TaskType } from '../../common/enum/Task.js';

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
  type: TaskType;

  @Attribute(DataTypes.STRING(20))
  state: TaskState;

  @Attribute(DataTypes.STRING(214))
  targetName: string;

  @Attribute(DataTypes.STRING(24))
  authorId: string;

  @Attribute(DataTypes.STRING(100))
  authorIp: string;

  @Attribute(DataTypes.JSONB)
  data: any;

  @Attribute(DataTypes.STRING(512))
  logPath: string;

  @Attribute(DataTypes.STRING(10))
  logStorePosition: string;

  @Attribute(DataTypes.INTEGER)
  attempts: number;

  @Attribute(DataTypes.TEXT(LENGTH_VARIANTS.long))
  error: string;

  @Attribute(DataTypes.STRING(48), {
    unique: true,
  })
  bizId: string;
}
