import { Entity, type EntityData } from './Entity.ts';
import { EntityUtil, type EasyData } from '../util/EntityUtil.ts';

interface ChangeData extends EntityData {
  changeId: string;
  type: string;
  targetName: string;
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  data: any;
}

export class Change extends Entity {
  changeId: string;
  type: string;
  targetName: string;
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  data: any;

  constructor(data: ChangeData) {
    super(data);
    this.changeId = data.changeId;
    this.type = data.type;
    this.targetName = data.targetName;
    this.data = data.data;
  }

  static create(data: EasyData<ChangeData, 'changeId'>) {
    const newData = EntityUtil.defaultData(data, 'changeId');
    return new Change(newData);
  }
}
