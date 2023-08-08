import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { Binary as BinaryModel } from './model/Binary';
import { Binary as BinaryEntity } from '../core/entity/Binary';
import { AbstractRepository } from './AbstractRepository';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BinaryRepository extends AbstractRepository {
  @Inject()
  private readonly Binary: typeof BinaryModel;

  async saveBinary(binary: BinaryEntity): Promise<void> {
    if (binary.id) {
      const model = await this.Binary.findOne({ id: binary.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel<BinaryModel>(binary as unknown as Record<string, unknown>, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(binary as unknown as Record<string, unknown>, this.Binary);
      this.logger.info('[BinaryRepository:saveBinary:new] id: %s, binaryId: %s', model.id, model.binaryId);
    }
  }

  async findBinary(category: string, parent: string, name: string) {
    const model = await this.Binary.findOne({ category, parent, name });
    if (model) return ModelConvertor.convertModelToEntity(model, BinaryEntity);
    return null;
  }

  async listBinaries(category: string, parent: string): Promise<BinaryEntity[]> {
    const models = await this.Binary.find({ category, parent });
    return models.map(model => ModelConvertor.convertModelToEntity(model, BinaryEntity));
  }
}
