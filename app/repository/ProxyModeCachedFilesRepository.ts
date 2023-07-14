import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { ProxyModeCachedFiles as ProxyModeCachedFilesModel } from './model/ProxyModeCachedFiles';
import { ProxyModeCachedFiles as ProxyModeCachedFilesEntity } from '../core/entity/ProxyModeCachedFiles';
import { AbstractRepository } from './AbstractRepository';
import { DIST_NAMES } from '../core/entity/Package';
import { EntityUtil, PageOptions, PageResult } from '../core/util/EntityUtil';
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyModeCachedFilesRepository extends AbstractRepository {
  @Inject()
  private readonly ProxyModeCachedFiles: typeof ProxyModeCachedFilesModel;

  async savePackageManifests(proxyModeCachedFiles: ProxyModeCachedFilesEntity) {
    try {
      await ModelConvertor.convertEntityToModel(proxyModeCachedFiles, this.ProxyModeCachedFiles);
    } catch (e) {
      e.message = '[ProxyModeRepository] insert ProxyModeCachedFiles failed: ' + e.message;
      throw e;
    }
  }

  async findCachedPackageManifest(targetName, isFullManifests): Promise<ProxyModeCachedFilesEntity | null> {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    const model = await this.ProxyModeCachedFiles.findOne({ targetName, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity);
    return null;
  }

  async findCachedPackageVersionManifest(targetName, version, isFullManifests): Promise<ProxyModeCachedFilesEntity | null> {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    const model = await this.ProxyModeCachedFiles.findOne({ targetName, version, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity);
    return null;
  }

  async removePackageStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    await this.ProxyModeCachedFiles.remove({ targetName, fileType });
  }

  async removePackageVersionStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    await this.ProxyModeCachedFiles.remove({ targetName, fileType });
  }

  async listCachedFiles(page: PageOptions): Promise<PageResult<ProxyModeCachedFilesEntity>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.ProxyModeCachedFiles.find().count();
    const models = await this.ProxyModeCachedFiles.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity)),
    };
  }

}
