import { Entity, EntityData } from './Entity';
import { EasyData } from '../util/EntityUtil';
interface ProxyModeData extends EntityData {
  targetName: string;
  fileType: string;
  filePath: string;
}

export type CreateProxyModeData = Omit<EasyData<ProxyModeData, 'id'>, 'id'>;

export class ProxyModeCachedFiles extends Entity {
  readonly targetName: string;
  readonly fileType: string;
  readonly filePath: string;

  constructor(data: ProxyModeData) {
    super(data);
    this.targetName = data.targetName;
    this.fileType = data.fileType;
    this.filePath = data.filePath;
  }

  public static create(data: CreateProxyModeData): ProxyModeCachedFiles {
    const newData = { ...data, createdAt: new Date(), updatedAt: new Date() };
    return new ProxyModeCachedFiles(newData);
  }

}
