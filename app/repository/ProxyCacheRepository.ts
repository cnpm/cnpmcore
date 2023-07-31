import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { ProxyCache as ProxyModeCachedFilesModel } from './model/ProxyCache';
import { ProxyCache as ProxyModeCachedFilesEntity } from '../core/entity/ProxyCache';
import { AbstractRepository } from './AbstractRepository';
import { DIST_NAMES } from '../core/entity/Package';
import { EntityUtil, PageOptions, PageResult } from '../core/util/EntityUtil';
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyCacheRepository extends AbstractRepository {
  @Inject()
  private readonly ProxyCache: typeof ProxyModeCachedFilesModel;

  async savePackageManifests(proxyModeCachedFiles: ProxyModeCachedFilesEntity) {
    try {
      await ModelConvertor.convertEntityToModel(proxyModeCachedFiles, this.ProxyCache);
    } catch (e) {
      e.message = '[ProxyModeRepository] insert ProxyCache failed: ' + e.message;
      throw e;
    }
  }

  async findCachedPackageManifest(targetName, isFullManifests): Promise<ProxyModeCachedFilesEntity | null> {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    const model = await this.ProxyCache.findOne({ targetName, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity);
    return null;
  }

  async findCachedPackageVersionManifest(targetName, version, isFullManifests): Promise<ProxyModeCachedFilesEntity | null> {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    const model = await this.ProxyCache.findOne({ targetName, version, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity);
    return null;
  }

  async removePackageStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    await this.ProxyCache.remove({ targetName, fileType });
  }

  async removePackageVersionStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    await this.ProxyCache.remove({ targetName, fileType });
  }

  async listCachedFiles(page: PageOptions): Promise<PageResult<ProxyModeCachedFilesEntity>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.ProxyCache.find().count();
    const models = await this.ProxyCache.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity)),
    };
  }

}
