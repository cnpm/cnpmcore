import { Attribute, Model } from 'egg/orm';

import type { TaskState, TaskType } from '../../common/enum/Task.ts';
import { Bone, DataTypes, LENGTH_VARIANTS } from '../util/leoric.ts';

@Model()
export class HistoryTask extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  declare taskId: string;

  @Attribute(DataTypes.STRING(20))
  declare type: TaskType;

  @Attribute(DataTypes.STRING(20))
  declare state: TaskState;

  @Attribute(DataTypes.STRING(214))
  declare targetName: string;

  @Attribute(DataTypes.STRING(24))
  declare authorId: string;

  @Attribute(DataTypes.STRING(100))
  declare authorIp: string;

  @Attribute(DataTypes.JSONB)
  declare data: object;

  @Attribute(DataTypes.STRING(512))
  declare logPath: string;

  @Attribute(DataTypes.STRING(10))
  declare logStorePosition: string;

  @Attribute(DataTypes.INTEGER)
  declare attempts: number;

  @Attribute(DataTypes.TEXT(LENGTH_VARIANTS.long))
  declare error: string;
}
