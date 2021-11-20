import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { Dist } from './Dist';

export interface PackageData extends EntityData {
  scope: string;
  name: string;
  packageId: string;
  isPrivate: boolean;
  description: string;
  abbreviatedsDist?: Dist;
  manifestsDist?: Dist;
}

export enum DIST_NAMES {
  ABBREVIATED = 'abbreviated.json',
  MANIFEST = 'package.json',
  README = 'readme.md',
  FULL_MANIFESTS = 'full_manifests.json',
  ABBREVIATED_MANIFESTS = 'abbreviated_manifests.json',
}

interface FileInfo {
  size: number;
  shasum: string;
  integrity: string;
}

export class Package extends Entity {
  readonly scope: string;
  readonly name: string;
  readonly packageId: string;
  readonly isPrivate: boolean;
  // allow to update
  description: string;
  abbreviatedsDist?: Dist;
  manifestsDist?: Dist;

  constructor(data: PackageData) {
    super(data);
    this.scope = data.scope;
    this.name = data.name;
    this.packageId = data.packageId;
    this.isPrivate = data.isPrivate;
    this.description = data.description;
    this.abbreviatedsDist = data.abbreviatedsDist;
    this.manifestsDist = data.manifestsDist;
  }

  static create(data: EasyData<PackageData, 'packageId'>): Package {
    const newData = EntityUtil.defaultData(data, 'packageId');
    return new Package(newData);
  }

  get fullname() {
    return this.scope ? `${this.scope}/${this.name}` : this.name;
  }

  createAbbreviated(version: string, info: FileInfo) {
    return this.createDist(DIST_NAMES.ABBREVIATED, info, version);
  }

  createManifest(version: string, info: FileInfo) {
    return this.createDist(DIST_NAMES.MANIFEST, info, version);
  }

  createReadme(version: string, info: FileInfo) {
    return this.createDist(DIST_NAMES.README, info, version);
  }

  createTar(version: string, info: FileInfo) {
    return this.createDist(`${this.name}-${version}.tgz`, info, version);
  }

  createFullManifests(info: FileInfo) {
    return this.createDist(DIST_NAMES.FULL_MANIFESTS, info);
  }

  createAbbreviatedManifests(info: FileInfo) {
    return this.createDist(DIST_NAMES.ABBREVIATED_MANIFESTS, info);
  }

  private distDir(filename: string, version?: string) {
    const name = this.scope ? `${this.scope}/${this.name}` : this.name;
    if (version) {
      return `/packages/${name}/${version}/${filename}`;
    }
    return `/packages/${name}/${filename}`;
  }

  private createDist(name: string, info: FileInfo, version?: string) {
    return Dist.create({
      name,
      size: info.size,
      shasum: info.shasum,
      integrity: info.integrity,
      path: this.distDir(name, version),
    });
  }
}
