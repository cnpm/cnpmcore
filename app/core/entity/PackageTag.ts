import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

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
