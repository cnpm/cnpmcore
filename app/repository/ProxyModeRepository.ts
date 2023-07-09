import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { ProxyModeCachedFiles as ProxyModeModel } from './model/ProxyModeCachedFiles';
import { ProxyMode as ProxyModeEntity } from '../core/entity/ProxyMode';
import { AbstractRepository } from './AbstractRepository';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyModeRepository extends AbstractRepository {
  @Inject()
  private readonly ProxyMode: typeof ProxyModeModel;

  async findCachedFile(filePath: string) {
    const model = await this.ProxyMode.findOne({ filePath });
    if (model) return ModelConvertor.convertModelToEntity(model, ProxyModeEntity);
    return null;
  }

}
