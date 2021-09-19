import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

export interface UpstreamChangeData extends EntityData {
  upstreamChangeId: string;
  seq: number;
  name: string;
  changes: string;
}

export class UpstreamChange extends Entity {
  readonly upstreamChangeId: string;
  readonly seq: number;
  readonly name: string;
  readonly changes: string;

  constructor(data: UpstreamChangeData) {
    super(data);
    this.upstreamChangeId = data.upstreamChangeId;
    this.seq = data.seq;
    this.name = data.name;
    this.changes = data.changes;
  }

  static create(data: EasyData<UpstreamChangeData, 'upstreamChangeId'>): UpstreamChange {
    const newData = EntityUtil.defaultData(data, 'upstreamChangeId');
    return new UpstreamChange(newData);
  }
}
