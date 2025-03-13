import type { EntityData } from './Entity.js';
import { Entity } from './Entity.js';
import type { EasyData } from '../util/EntityUtil.js';
import { EntityUtil } from '../util/EntityUtil.js';

interface PackageTagData extends EntityData {
  packageId: string;
  packageTagId: string;
  tag: string;
  version: string;
}

export class PackageTag extends Entity {
  packageId: string;
  packageTagId: string;
  tag: string;
  version: string;

  constructor(data: PackageTagData) {
    super(data);
    this.packageId = data.packageId;
    this.packageTagId = data.packageTagId;
    this.tag = data.tag;
    this.version = data.version;
  }

  static create(data: EasyData<PackageTagData, 'packageTagId'>): PackageTag {
    const newData = EntityUtil.defaultData(data, 'packageTagId');
    return new PackageTag(newData);
  }
}
