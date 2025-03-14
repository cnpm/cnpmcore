import type { EntityData } from './Entity.js';
import { Entity } from './Entity.js';
import type { EasyData } from '../util/EntityUtil.js';
import { EntityUtil } from '../util/EntityUtil.js';

interface PackageVersionManifestData extends EntityData {
  packageId: string;
  packageVersionId: string;
  packageVersionManifestId: string;
  manifest: any;
}

export class PackageVersionManifest extends Entity {
  packageId: string;
  packageVersionId: string;
  packageVersionManifestId: string;
  manifest: any;

  constructor(data: PackageVersionManifestData) {
    super(data);
    this.packageId = data.packageId;
    this.packageVersionId = data.packageVersionId;
    this.packageVersionManifestId = data.packageVersionManifestId;
    this.manifest = data.manifest;
  }

  static create(
    data: EasyData<PackageVersionManifestData, 'packageVersionManifestId'>
  ): PackageVersionManifest {
    const newData = EntityUtil.defaultData(data, 'packageVersionManifestId');
    return new PackageVersionManifest(newData);
  }
}
