import { Dist } from './Dist';
import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { PaddingSemVer } from './PaddingSemVer';

interface PackageVersionData extends EntityData {
  packageId: string;
  packageVersionId: string;
  version: string;
  abbreviatedDist: Dist;
  manifestDist: Dist;
  tarDist: Dist;
  readmeDist: Dist;
  publishTime: Date;
  paddingVersion?: string | null;
  isPreRelease?: boolean | null;
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
  paddingVersion: string;
  isPreRelease: boolean;

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
    if (data.paddingVersion && typeof data.isPreRelease === 'boolean') {
      this.paddingVersion = data.paddingVersion;
      this.isPreRelease = data.isPreRelease;
    } else {
      const paddingSemVer = new PaddingSemVer(this.version);
      this.paddingVersion = paddingSemVer.paddingVersion;
      this.isPreRelease = paddingSemVer.isPreRelease;
    }
  }

  static create(data: EasyData<PackageVersionData, 'packageVersionId'>): PackageVersion {
    const newData = EntityUtil.defaultData(data, 'packageVersionId');
    return new PackageVersion(newData);
  }
}
