import { Dist } from './Dist.js';
import { Entity, EntityData } from './Entity.js';
import { EasyData, EntityUtil } from '../util/EntityUtil.js';

interface PackageVersionFileData extends EntityData {
  packageVersionFileId: string;
  packageVersionId: string;
  dist: Dist;
  directory: string;
  name: string;
  contentType: string;
  mtime: Date;
}

export class PackageVersionFile extends Entity {
  packageVersionFileId: string;
  packageVersionId: string;
  dist: Dist;
  directory: string;
  name: string;
  contentType: string;
  mtime: Date;

  constructor(data: PackageVersionFileData) {
    super(data);
    this.packageVersionFileId = data.packageVersionFileId;
    this.packageVersionId = data.packageVersionId;
    this.dist = data.dist;
    this.directory = data.directory;
    this.name = data.name;
    this.contentType = data.contentType;
    this.mtime = data.mtime;
  }

  get path() {
    return this.directory === '/' ? `/${this.name}` : `${this.directory}/${this.name}`;
  }

  static create(data: EasyData<PackageVersionFileData, 'packageVersionFileId'>): PackageVersionFile {
    const newData = EntityUtil.defaultData(data, 'packageVersionFileId');
    return new PackageVersionFile(newData);
  }
}
