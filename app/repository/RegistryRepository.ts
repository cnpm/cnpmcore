import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { Registry as RegistryEntity } from '../core/entity/Registry';
import { AbstractRepository } from './AbstractRepository';
import type { Registry as RegistryModel } from './model/Registry';
import { EasyData } from 'app/core/util/EntityUtil';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class RegistryRepository extends AbstractRepository {
  @Inject()
  private readonly Registry: typeof RegistryModel;

  async listRegistries(): Promise<RegistryEntity[]> {
    const models = await this.Registry.find();
    return models.map(model => ModelConvertor.convertModelToEntity(model, RegistryEntity));
  }

  async findRegistry(name: string): Promise<RegistryEntity | null> {
    const model = await this.Registry.findOne({ name });
    if (model) {
      return ModelConvertor.convertModelToEntity(model, RegistryEntity);
    }
    return null;
  }

  async saveRegistry(registry: EasyData<RegistryEntity, 'id' | 'registryId'>) {
    if (registry.id) {
      const model = await this.Registry.findOne({ registryId: registry.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(registry, model);
      return model;
    } else {
      const model = await ModelConvertor.convertEntityToModel(registry, this.Registry);
      this.logger.info('[RegistryRepository:saveRegistry:new] id: %s, registryId: %s',
        model.id, model.registryId);
      return model;
    }
  }

  async removeRegistry(registryId: string): Promise<void> {
    await this.Registry.remove({ registryId });
  }

}
