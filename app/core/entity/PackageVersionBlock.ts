import { Entity, type EntityData } from './Entity.js';
import { EntityUtil, type EasyData } from '../util/EntityUtil.js';

interface PackageVersionBlockData extends EntityData {
  packageVersionBlockId: string;
  packageId: string;
  version: string;
  reason: string;
}

export class PackageVersionBlock extends Entity {
  packageVersionBlockId: string;
  packageId: string;
  version: string;
  reason: string;

  constructor(data: PackageVersionBlockData) {
    super(data);
    this.packageVersionBlockId = data.packageVersionBlockId;
    this.packageId = data.packageId;
    this.version = data.version;
    this.reason = data.reason;
  }

  static create(
    data: EasyData<PackageVersionBlockData, 'packageVersionBlockId'>
  ): PackageVersionBlock {
    const newData = EntityUtil.defaultData(data, 'packageVersionBlockId');
    return new PackageVersionBlock(newData);
  }
}
