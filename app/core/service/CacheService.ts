import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { AbstractService } from './AbstractService';

type PackageCacheAttribe = 'etag' | 'manifests';

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
