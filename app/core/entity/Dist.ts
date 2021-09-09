import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

export interface DistData extends EntityData {
  distId: string;
  name: string;
  path: string;
  size: number;
  shasum: string;
}

export class Dist extends Entity {
  readonly distId: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly shasum: string;

  constructor(data: DistData) {
    super(data);
    this.distId = data.distId;
    this.name = data.name;
    this.path = data.path;
    this.size = data.size;
    this.shasum = data.shasum;
  }

  static create(data: EasyData<DistData, 'distId'>): Dist {
    const newData = EntityUtil.defaultData(data, 'distId');
    return new Dist(newData);
  }
}
