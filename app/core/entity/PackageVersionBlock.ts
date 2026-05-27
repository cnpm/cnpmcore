import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

// dependency isolation buffer record (auto-releasable). null type = permanent block.
export const PACKAGE_VERSION_BLOCK_TYPE_BUFFER = 'buffer';

interface PackageVersionBlockData extends EntityData {
  packageVersionBlockId: string;
  packageId: string;
  version: string;
  reason: string;
  type?: string | null;
  expiredAt?: Date | null;
}

export class PackageVersionBlock extends Entity {
  packageVersionBlockId: string;
  packageId: string;
  version: string;
  reason: string;
  type: string | null;
  expiredAt: Date | null;

  constructor(data: PackageVersionBlockData) {
    super(data);
    this.packageVersionBlockId = data.packageVersionBlockId;
    this.packageId = data.packageId;
    this.version = data.version;
    this.reason = data.reason;
    this.type = data.type ?? null;
    this.expiredAt = data.expiredAt ?? null;
  }

  get isBuffer(): boolean {
    return this.type === PACKAGE_VERSION_BLOCK_TYPE_BUFFER;
  }

  static create(data: EasyData<PackageVersionBlockData, 'packageVersionBlockId'>): PackageVersionBlock {
    const newData = EntityUtil.defaultData(data, 'packageVersionBlockId');
    return new PackageVersionBlock(newData);
  }
}
