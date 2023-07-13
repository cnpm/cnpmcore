import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { ProxyModeCachedFiles as ProxyModeCachedFilesModel } from './model/ProxyModeCachedFiles';
import { ProxyModeCachedFiles as ProxyModeCachedFilesEntity } from '../core/entity/ProxyModeCachedFiles';
import { AbstractRepository } from './AbstractRepository';
import { DIST_NAMES } from '../core/entity/Package';
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

  public async findPackageStoreKey(targetName, isFullManifests): Promise<string| null> {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    const model = await this.ProxyModeCachedFiles.findOne({ targetName, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity).filePath;
    return null;
  }

  public async findPackageVersionStoreKey(targetName, isFullManifests): Promise<string| null> {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    const model = await this.ProxyModeCachedFiles.findOne({ targetName, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity).filePath;
    return null;
  }

  public async removePackageStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.FULL_MANIFESTS : DIST_NAMES.ABBREVIATED_MANIFESTS;
    await this.ProxyModeCachedFiles.remove({ targetName, fileType });
  }

  public async removePackageVersionStoreKey(targetName, isFullManifests) {
    const fileType = isFullManifests ? DIST_NAMES.MANIFEST : DIST_NAMES.ABBREVIATED;
    await this.ProxyModeCachedFiles.remove({ targetName, fileType });
  }

}
