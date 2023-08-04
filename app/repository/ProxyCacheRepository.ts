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

  async saveProxyCache(proxyModeCachedFiles: ProxyModeCachedFilesEntity) {
    let model = await this.ProxyCache.findOne({ fullname: proxyModeCachedFiles.fullname, version: proxyModeCachedFiles.version, fileType: proxyModeCachedFiles.fileType });
    if (model) {
      model.updatedAt = proxyModeCachedFiles.updatedAt;
      model.save();
    } else {
      try {
        model = await ModelConvertor.convertEntityToModel(proxyModeCachedFiles, this.ProxyCache);
        this.logger.info('[ProxyCacheRepository:saveProxyCache:new] id: %s, packageFullname: %s',
          model.id, model.fullname);
      } catch (e) {
        e.message = '[ProxyCacheRepository] insert ProxyCache failed: ' + e.message;
        throw e;
      }
    }
  }

  async findProxyCache(fullname: string, fileType: DIST_NAMES, version?: string): Promise<ProxyModeCachedFilesEntity | null> {
    const model = version ? await this.ProxyCache.findOne({ fullname, version, fileType }) : await this.ProxyCache.findOne({ fullname, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeCachedFilesEntity);
    return null;
  }

  async removeProxyCache(fullname: string, fileType: string) {
    await this.ProxyCache.remove({ fullname, fileType });
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
