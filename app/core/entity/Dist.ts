import { Entity, type EntityData } from './Entity.ts';
import { EntityUtil, type EasyData } from '../util/EntityUtil.ts';

interface DistData extends EntityData {
  distId: string;
  name: string;
  path: string;
  size: number;
  shasum: string;
  integrity: string;
}

export class Dist extends Entity {
  readonly distId: string;
  readonly name: string;
  readonly path: string;
  // allow to update
  size: number;
  shasum: string;
  integrity: string;

  constructor(data: DistData) {
    super(data);
    this.distId = data.distId;
    this.name = data.name;
    this.path = data.path;
    this.size = data.size;
    this.shasum = data.shasum;
    this.integrity = data.integrity;
  }

  static create(data: EasyData<DistData, 'distId'>): Dist {
    const newData = EntityUtil.defaultData(data, 'distId');
    return new Dist(newData);
  }
}
