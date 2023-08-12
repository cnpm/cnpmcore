import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { ProxyCache as ProxyModeCachedFilesModel } from './model/ProxyCache';
import { ProxyCache as ProxyCacheEntity } from '../core/entity/ProxyCache';
import { AbstractRepository } from './AbstractRepository';
import { DIST_NAMES } from '../core/entity/Package';
import { EntityUtil, PageOptions, PageResult } from '../core/util/EntityUtil';
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyCacheRepository extends AbstractRepository {
  @Inject()
  private readonly ProxyCache: typeof ProxyModeCachedFilesModel;

  async saveProxyCache(proxyCacheEntity: ProxyCacheEntity) {
    let model = proxyCacheEntity.version ?
      await this.ProxyCache.findOne({ fullname: proxyCacheEntity.fullname, version: proxyCacheEntity.version, fileType: proxyCacheEntity.fileType }) :
      await this.ProxyCache.findOne({ fullname: proxyCacheEntity.fullname, fileType: proxyCacheEntity.fileType });
    if (model) {
      model.updatedAt = proxyCacheEntity.updatedAt;
      await model.save();
    } else {
      try {
        model = await ModelConvertor.convertEntityToModel(proxyCacheEntity, this.ProxyCache);
      } catch (e) {
        e.message = '[ProxyCacheRepository] insert ProxyCache failed: ' + e.message;
        throw e;
      }
    }
    return model;
  }

  async findProxyCache(fullname: string, fileType: DIST_NAMES, version?: string): Promise<ProxyCacheEntity | null> {
    const model = version ? await this.ProxyCache.findOne({ fullname, version, fileType }) : await this.ProxyCache.findOne({ fullname, fileType });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyCacheEntity);
    return null;
  }

  async removeProxyCache(fullname: string, fileType: string) {
    await this.ProxyCache.remove({ fullname, fileType });
  }

  async listCachedFiles(page: PageOptions): Promise<PageResult<ProxyCacheEntity>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.ProxyCache.find().count();
    const models = await this.ProxyCache.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, ProxyCacheEntity)),
    };
  }

}
