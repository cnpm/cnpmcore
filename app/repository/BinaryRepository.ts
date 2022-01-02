import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { Binary as BinaryModel } from './model/Binary';
import { Binary as BinaryEntity } from '../core/entity/Binary';
import { AbstractRepository } from './AbstractRepository';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BinaryRepository extends AbstractRepository {
  async saveBinary(binary: BinaryEntity): Promise<void> {
    if (binary.id) {
      const model = await BinaryModel.findOne({ id: binary.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(binary, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(binary, BinaryModel);
      this.logger.info('[BinaryRepository:saveBinary:new] id: %s, binaryId: %s', model.id, model.binaryId);
    }
  }

  async findBinary(type: string, parent: string, name: string) {
    const model = await BinaryModel.findOne({ type, parent, name });
    if (model) return ModelConvertor.convertModelToEntity(model, BinaryEntity);
    return null;
  }

  async listBinaries(type: string, parent: string): Promise<BinaryEntity[]> {
    const models = await BinaryModel.find({ type, parent });
    return models.map(model => ModelConvertor.convertModelToEntity(model, BinaryEntity));
  }
}
