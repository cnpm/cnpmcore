import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { AbstractService } from '../../common/AbstractService';

type PackageCacheAttribe = 'etag' | 'manifests';

type TotalData = {
  packageCount: number;
  packageVersionCount: number;
  lastPackage: string;
  lastPackageVersion: string;
  download: {
    today: number;
    yesterday: number;
    samedayLastweek: number;
    thisweek: number;
    thismonth: number;
    thisyear: number;
    lastweek: number;
    lastmonth: number;
    lastyear: number;
  };
  changesStream: object,
  lastChangeId: number | bigint;
  cacheTime: string;
};
const TOTAL_DATA_KEY = '__TOTAL_DATA__';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class CacheService extends AbstractService {
  @Inject()
  private cacheAdapter: CacheAdapter;

  public async getPackageEtag(fullname: string, isFullManifests: boolean) {
    const key = this.cacheKey(fullname, isFullManifests, 'etag');
    return await this.cacheAdapter.get(key);
  }

  public async getPackageManifests(fullname: string, isFullManifests: boolean) {
    const key = this.cacheKey(fullname, isFullManifests, 'manifests');
    return await this.cacheAdapter.getBytes(key);
  }

  public async savePackageEtagAndManifests(fullname: string, isFullManifests: boolean, etag: string, manifests: Buffer) {
    await Promise.all([
      await this.cacheAdapter.set(this.cacheKey(fullname, isFullManifests, 'etag'), etag),
      await this.cacheAdapter.setBytes(this.cacheKey(fullname, isFullManifests, 'manifests'), manifests),
    ]);
  }

  public async getTotalData() {
    const value = await this.cacheAdapter.get(TOTAL_DATA_KEY);
    const totalData: TotalData = value ? JSON.parse(value) : {
      packageCount: 0,
      packageVersionCount: 0,
      lastPackage: '',
      lastPackageVersion: '',
      download: {
        today: 0,
        thisweek: 0,
        thismonth: 0,
        thisyear: 0,
        lastday: 0,
        lastweek: 0,
        lastmonth: 0,
        lastyear: 0,
      },
      changesStream: {},
      lastChangeId: 0,
      cacheTime: '',
    };
    return totalData;
  }

  public async saveTotalData(totalData: TotalData) {
    return await this.cacheAdapter.set(TOTAL_DATA_KEY, JSON.stringify(totalData));
  }

  public async removeCache(fullname: string) {
    await Promise.all([
      await this.cacheAdapter.delete(this.cacheKey(fullname, true, 'etag')),
      await this.cacheAdapter.delete(this.cacheKey(fullname, true, 'manifests')),
      await this.cacheAdapter.delete(this.cacheKey(fullname, false, 'etag')),
      await this.cacheAdapter.delete(this.cacheKey(fullname, false, 'manifests')),
    ]);
  }

  private cacheKey(fullname: string, isFullManifests: boolean, attribute: PackageCacheAttribe) {
    return `${fullname}|${isFullManifests ? 'full' : 'abbr'}:${attribute}`;
  }
}
