import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

export interface DistData extends EntityData {
  distId: string;
  name: string;
  path: string;
  size: number;
  shasum: string;
  integrity: string;
  meta: string;
}

export class Dist extends Entity {
  readonly distId: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly shasum: string;
  readonly integrity: string;
  readonly meta: string;

  constructor(data: DistData) {
    super(data);
    this.distId = data.distId;
    this.name = data.name;
    this.path = data.path;
    this.size = data.size;
    this.shasum = data.shasum;
    this.integrity = data.integrity;
    this.meta = data.meta;
  }

  static create(data: EasyData<DistData, 'distId'>): Dist {
    const newData = EntityUtil.defaultData(data, 'distId');
    return new Dist(newData);
  }
}
