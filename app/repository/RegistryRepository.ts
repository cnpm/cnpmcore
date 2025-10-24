import { AccessLevel, Inject, SingletonProto } from 'egg';

import { ModelConvertor } from './util/ModelConvertor.ts';
import { Registry as RegistryEntity } from '../core/entity/Registry.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import type { Registry as RegistryModel } from './model/Registry.ts';
import {
  EntityUtil,
  type PageOptions,
  type PageResult,
} from '../core/util/EntityUtil.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class RegistryRepository extends AbstractRepository {
  @Inject()
  private readonly Registry: typeof RegistryModel;

  async listRegistries(page: PageOptions): Promise<PageResult<RegistryEntity>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.Registry.find().count();
    const models = await this.Registry.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model =>
        ModelConvertor.convertModelToEntity(model, RegistryEntity)
      ),
    };
  }

  async findRegistry(name?: string): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ name });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async findRegistryByRegistryId(
    registryId: string
  ): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ registryId });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async findRegistryByRegistryHost(
    host: string
  ): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ host });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async saveRegistry(registry: RegistryEntity) {
    if (registry.id) {
      const model = await this.Registry.findOne({ id: registry.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(registry, model);
      return model;
    }
    const model = await ModelConvertor.convertEntityToModel(
      registry,
      this.Registry
    );
    this.logger.info(
      '[RegistryRepository:saveRegistry:new] id: %s, registryId: %s',
      model.id,
      model.registryId
    );
    return model;
  }

  async removeRegistry(registryId: string): Promise<void> {
    await this.Registry.remove({ registryId });
  }
}
