import type { EntityData } from './Entity.js';
import { Entity } from './Entity.js';
import type { EasyData } from '../util/EntityUtil.js';
import { EntityUtil } from '../util/EntityUtil.js';
import { Dist } from './Dist.js';
import { getFullname } from '../../common/PackageUtil.js';

interface PackageData extends EntityData {
  scope: string;
  name: string;
  packageId: string;
  isPrivate: boolean;
  description: string;
  abbreviatedsDist?: Dist;
  manifestsDist?: Dist;
  registryId?: string;
}

export enum DIST_NAMES {
  ABBREVIATED = 'abbreviated.json',
  MANIFEST = 'package.json',
  README = 'readme.md',
  FULL_MANIFESTS = 'full_manifests.json',
  ABBREVIATED_MANIFESTS = 'abbreviated_manifests.json',
}

export function isPkgManifest(fileType: DIST_NAMES) {
  return (
    fileType === DIST_NAMES.FULL_MANIFESTS ||
    fileType === DIST_NAMES.ABBREVIATED_MANIFESTS
  );
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
  registryId?: string;

  constructor(data: PackageData) {
    super(data);
    this.scope = data.scope;
    this.name = data.name;
    this.packageId = data.packageId;
    this.isPrivate = data.isPrivate;
    this.description = data.description;
    this.abbreviatedsDist = data.abbreviatedsDist;
    this.manifestsDist = data.manifestsDist;
    this.registryId = data.registryId;
  }

  static create(data: EasyData<PackageData, 'packageId'>): Package {
    const newData = EntityUtil.defaultData(data, 'packageId');
    return new Package(newData);
  }

  get fullname() {
    return getFullname(this.scope, this.name);
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

  createPackageVersionFile(path: string, version: string, info: FileInfo) {
    // path should starts with `/`, e.g.: '/foo/bar/index.js'
    return this.createDist(`files${path}`, info, version);
  }

  private distDir(filename: string, version?: string) {
    if (version) {
      return `/packages/${this.fullname}/${version}/${filename}`;
    }
    return `/packages/${this.fullname}/${filename}`;
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
