import { Entity, EntityData } from './Entity';
import { EasyData } from '../util/EntityUtil';
import { DIST_NAMES } from './Package';
import { isPkgManifest } from '../service/ProxyCacheService';
import { PROXY_CACHE_DIR_NAME } from '../../common/constants';
interface ProxyCacheData extends EntityData {
  fullname: string;
  fileType: DIST_NAMES;
  version?: string;
}

export type CreateProxyCacheData = Omit<EasyData<ProxyCacheData, 'id'>, 'id'| 'filePath'>;

export class ProxyCache extends Entity {
  readonly fullname: string;
  readonly fileType: DIST_NAMES;
  readonly filePath: string;
  readonly version?: string;

  constructor(data: ProxyCacheData) {
    super(data);
    this.fullname = data.fullname;
    this.fileType = data.fileType;
    this.version = data.version;
    if (isPkgManifest(data.fileType)) {
      this.filePath = `/${PROXY_CACHE_DIR_NAME}/${data.fullname}/${data.fileType}`;
    } else {
      this.filePath = `/${PROXY_CACHE_DIR_NAME}/${data.fullname}/${data.version}/${data.fileType}`;
    }
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
