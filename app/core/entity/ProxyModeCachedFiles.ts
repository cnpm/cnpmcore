import { Entity, EntityData } from './Entity';
import { EasyData } from '../util/EntityUtil';
interface ProxyModeData extends EntityData {
  targetName: string;
  fileType: string;
  filePath: string;
  version?: string;
  lastErrorMessage?: string;
}

export type CreateProxyModeData = Omit<EasyData<ProxyModeData, 'id'>, 'id'>;

export class ProxyModeCachedFiles extends Entity {
  readonly targetName: string;
  readonly fileType: string;
  readonly filePath: string;
  readonly version?: string;
  lastErrorMessage?: string;

  constructor(data: ProxyModeData) {
    super(data);
    this.targetName = data.targetName;
    this.fileType = data.fileType;
    this.filePath = data.filePath;
    this.version = data.version;
  }

  public static create(data: CreateProxyModeData): ProxyModeCachedFiles {
    const newData = { ...data, createdAt: new Date(), updatedAt: new Date() };
    return new ProxyModeCachedFiles(newData);
  }

  public static update(data: ProxyModeCachedFiles): ProxyModeCachedFiles {
    data.updatedAt = new Date();
    return data;
  }

}
