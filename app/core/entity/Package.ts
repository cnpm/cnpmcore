import path from 'path';
import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { Dist } from './Dist';

export interface PackageData extends EntityData {
  scope?: string;
  name: string;
  packageId: string;
  isPrivate: boolean;
  description: string;
}

export enum DIST_NAMES {
  ABBREVIATED = 'abbreviated.json',
  MANIFEST = 'package.json',
  README = 'readme.md',
}

interface FileInfo {
  size: number;
  shasum: string;
  integrity: string;
  meta?: object;
}

export class Package extends Entity {
  readonly scope?: string;
  readonly name: string;
  readonly packageId: string;
  readonly isPrivate: boolean;
  // allow to update
  description: string;

  constructor(data: PackageData) {
    super(data);
    this.scope = data.scope;
    this.name = data.name;
    this.packageId = data.packageId;
    this.isPrivate = data.isPrivate;
    this.description = data.description;
  }

  static create(data: EasyData<PackageData, 'packageId'>): Package {
    const newData = EntityUtil.defaultData(data, 'packageId');
    return new Package(newData);
  }

  distDir(version: string) {
    if (this.scope) {
      return `/packages/${this.scope}/${this.name}/${version}/`;
    }
    return `/packages/${this.name}/${version}/`;
  }

  private createDist(version: string, name: string, info: FileInfo) {
    return Dist.create({
      name,
      size: info.size,
      shasum: info.shasum,
      integrity: info.integrity,
      path: path.join(this.distDir(version), name),
      meta: JSON.stringify(info.meta ?? {}),
    });
  }

  createAbbreviated(version: string, info: FileInfo) {
    return this.createDist(version, DIST_NAMES.ABBREVIATED, info);
  }

  createManifest(version: string, info: FileInfo) {
    return this.createDist(version, DIST_NAMES.MANIFEST, info);
  }

  createReadme(version: string, info: FileInfo) {
    return this.createDist(version, DIST_NAMES.README, info);
  }

  createTar(version: string, info: FileInfo) {
    return this.createDist(version, `${this.name}-${version}.tgz`, info);
  }
}
