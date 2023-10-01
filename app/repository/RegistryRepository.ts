import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { Registry, Registry as RegistryEntity } from '../core/entity/Registry';
import { AbstractRepository } from './AbstractRepository';
import type { Registry as RegistryModel } from './model/Registry';
import { EntityUtil, PageOptions, PageResult } from '../core/util/EntityUtil';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class RegistryRepository extends AbstractRepository {
  @Inject()
  private readonly Registry: typeof RegistryModel;

  async listRegistries(page: PageOptions): Promise<PageResult<Registry>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.Registry.find().count();
    const models = await this.Registry.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, RegistryEntity)),
    };
  }

  async findRegistry(name?: string): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ name });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async findRegistryByRegistryId(registryId: string): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ registryId });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async findRegistryByRegistryHost(host: string): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ host });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async saveRegistry(registry: Registry) {
    if (registry.id) {
      const model = await this.Registry.findOne({ id: registry.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(registry, model);
      return model;
    }
    const model = await ModelConvertor.convertEntityToModel(registry, this.Registry);
    this.logger.info('[RegistryRepository:saveRegistry:new] id: %s, registryId: %s',
      model.id, model.registryId);
    return model;

  }

  async removeRegistry(registryId: string): Promise<void> {
    await this.Registry.remove({ registryId });
  }

}
