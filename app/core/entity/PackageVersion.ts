import { Dist } from './Dist';
import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

export interface PackageVersionData extends EntityData {
  packageId: string;
  packageVersionId: string;
  version: string;
  abbreviatedDist: Dist;
  manifestDist: Dist;
  tarDist: Dist;
  readmeDist: Dist;
  publishTime: Date;
}

export class PackageVersion extends Entity {
  packageId: string;
  packageVersionId: string;
  version: string;
  abbreviatedDist: Dist;
  manifestDist: Dist;
  tarDist: Dist;
  readmeDist: Dist;
  publishTime: Date;

  constructor(data: PackageVersionData) {
    super(data);
    this.packageId = data.packageId;
    this.packageVersionId = data.packageVersionId;
    this.version = data.version;
    this.abbreviatedDist = data.abbreviatedDist;
    this.manifestDist = data.manifestDist;
    this.tarDist = data.tarDist;
    this.readmeDist = data.readmeDist;
    this.publishTime = data.publishTime;
  }

  static create(data: EasyData<PackageVersionData, 'packageVersionId'>): PackageVersion {
    const newData = EntityUtil.defaultData(data, 'packageVersionId');
    return new PackageVersion(newData);
  }
}
