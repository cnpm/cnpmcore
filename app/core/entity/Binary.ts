import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

interface BinaryData extends EntityData {
  binaryId: string;
  category: string;
  parent: string;
  name: string;
  isDir: boolean;
  size: number;
  date: string;
}

export class Binary extends Entity {
  binaryId: string;
  category: string;
  parent: string;
  name: string;
  isDir: boolean;
  size: number;
  date: string;

  constructor(data: BinaryData) {
    super(data);
    this.binaryId = data.binaryId;
    this.category = data.category;
    this.parent = data.parent;
    this.name = data.name;
    this.isDir = data.isDir;
    this.size = data.size;
    this.date = data.date;
  }

  get storePath() {
    // e.g.: /binaries/node/v16.13.1/node-v16.13.1-x64.msi
    return `/binaries/${this.category}${this.parent}${this.name}`;
  }

  static create(data: EasyData<BinaryData, 'binaryId'>): Binary {
    const newData = EntityUtil.defaultData(data, 'binaryId');
    return new Binary(newData);
  }
}
