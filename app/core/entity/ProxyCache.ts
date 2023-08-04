import { Entity, EntityData } from './Entity';
import { EasyData } from '../util/EntityUtil';
interface ProxyCacheData extends EntityData {
  fullname: string;
  fileType: string;
  filePath: string;
  version?: string;
}

export type CreateProxyCacheData = Omit<EasyData<ProxyCacheData, 'id'>, 'id'>;

export class ProxyCache extends Entity {
  readonly fullname: string;
  readonly fileType: string;
  readonly filePath: string;
  readonly version?: string;

  constructor(data: ProxyCacheData) {
    super(data);
    this.fullname = data.fullname;
    this.fileType = data.fileType;
    this.filePath = data.filePath;
    this.version = data.version;
  }

  public static create(data: CreateProxyCacheData): ProxyCache {
    const newData = { ...data, createdAt: new Date(), updatedAt: new Date() };
    return new ProxyCache(newData);
  }

  public static update(data: ProxyCache): ProxyCache {
    data.updatedAt = new Date();
    return data;
  }

}
