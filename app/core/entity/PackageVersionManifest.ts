import { EntityUtil, type EasyData } from '../util/EntityUtil.ts';
import { Entity, type EntityData } from './Entity.ts';

interface PackageVersionManifestData extends EntityData {
  packageId: string;
  packageVersionId: string;
  packageVersionManifestId: string;
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  manifest: any;
}

export class PackageVersionManifest extends Entity {
  packageId: string;
  packageVersionId: string;
  packageVersionManifestId: string;
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  manifest: any;

  constructor(data: PackageVersionManifestData) {
    super(data);
    this.packageId = data.packageId;
    this.packageVersionId = data.packageVersionId;
    this.packageVersionManifestId = data.packageVersionManifestId;
    this.manifest = data.manifest;
  }

  static create(data: EasyData<PackageVersionManifestData, 'packageVersionManifestId'>): PackageVersionManifest {
    const newData = EntityUtil.defaultData(data, 'packageVersionManifestId');
    return new PackageVersionManifest(newData);
  }
}
