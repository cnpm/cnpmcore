import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';

import { ModelConvertor } from './util/ModelConvertor.js';
import type { ProxyCache as ProxyModeCachedFilesModel } from './model/ProxyCache.js';
import { ProxyCache as ProxyCacheEntity } from '../core/entity/ProxyCache.js';
import { AbstractRepository } from './AbstractRepository.js';
import type { DIST_NAMES } from '../core/entity/Package.js';
import {
  EntityUtil,
  type PageOptions,
  type PageResult,
} from '../core/util/EntityUtil.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyCacheRepository extends AbstractRepository {
  @Inject()
  private readonly ProxyCache: typeof ProxyModeCachedFilesModel;

  async saveProxyCache(proxyCacheEntity: ProxyCacheEntity) {
    let model = proxyCacheEntity.version
      ? await this.ProxyCache.findOne({
          fullname: proxyCacheEntity.fullname,
          version: proxyCacheEntity.version,
          fileType: proxyCacheEntity.fileType,
        })
      : await this.ProxyCache.findOne({
          fullname: proxyCacheEntity.fullname,
          fileType: proxyCacheEntity.fileType,
        });
    if (model) {
      model.updatedAt = proxyCacheEntity.updatedAt;
      await model.save();
    } else {
      try {
        model = await ModelConvertor.convertEntityToModel(
          proxyCacheEntity,
          this.ProxyCache
        );
      } catch (e) {
        e.message = `[ProxyCacheRepository] insert ProxyCache failed: ${e.message}`;
        throw e;
      }
    }
    return model;
  }

  async findProxyCache(
    fullname: string,
    fileType: DIST_NAMES,
    version?: string
  ): Promise<ProxyCacheEntity | null> {
    const model = version
      ? await this.ProxyCache.findOne({ fullname, version, fileType })
      : await this.ProxyCache.findOne({ fullname, fileType });
    if (model)
      return ModelConvertor.convertModelToEntity(model, ProxyCacheEntity);
    return null;
  }

  // used by update & delete all cache
  async findProxyCaches(fullname: string, version?: string) {
    const models = version
      ? await this.ProxyCache.find({ fullname, version })
      : await this.ProxyCache.find({ fullname });
    return models;
  }

  async listCachedFiles(
    page: PageOptions,
    fullname?: string
  ): Promise<PageResult<ProxyCacheEntity>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = fullname
      ? await this.ProxyCache.find({ fullname }).count()
      : await this.ProxyCache.find().count();
    const models = fullname
      ? await this.ProxyCache.find({ fullname }).offset(offset).limit(limit)
      : await this.ProxyCache.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model =>
        ModelConvertor.convertModelToEntity(model, ProxyCacheEntity)
      ),
    };
  }

  async removeProxyCache(fullname: string, fileType: string, version?: string) {
    if (version) {
      await this.ProxyCache.remove({ fullname, version, fileType });
    } else {
      await this.ProxyCache.remove({ fullname, fileType });
    }
  }

  async truncateProxyCache() {
    await this.ProxyCache.truncate();
  }
}
