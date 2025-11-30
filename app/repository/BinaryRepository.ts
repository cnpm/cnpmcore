import { AccessLevel, Inject, SingletonProto } from 'egg';

import { Binary as BinaryEntity } from '../core/entity/Binary.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import type { Binary as BinaryModel } from './model/Binary.ts';
import { ModelConvertor } from './util/ModelConvertor.ts';

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
      const model = await ModelConvertor.convertEntityToModel(
        binary as unknown as Record<string, unknown>,
        this.Binary,
      );
      this.logger.info('[BinaryRepository:saveBinary:new] id: %s, binaryId: %s', model.id, model.binaryId);
    }
  }

  async findBinary(category: string, parent: string, name: string) {
    const model = await this.Binary.findOne({ category, parent, name });
    if (model) return ModelConvertor.convertModelToEntity(model, BinaryEntity);
    return null;
  }

  async listBinaries(
    category: string,
    parent: string,
    options?: {
      limit: number;
      since: string;
    },
  ): Promise<BinaryEntity[]> {
    let models;
    if (options) {
      models = await this.Binary.find({
        category,
        parent,
        date: { $gte: options.since },
      })
        .order('date', 'asc')
        .limit(options.limit);
    } else {
      models = await this.Binary.find({ category, parent });
    }
    return models.map((model) => ModelConvertor.convertModelToEntity(model, BinaryEntity));
  }

  async findLatestBinaryDir(category: string, parent: string): Promise<BinaryEntity | null> {
    const model = await this.Binary.findOne({ category, parent }).order('date', 'desc');
    if (model) {
      return ModelConvertor.convertModelToEntity(model, BinaryEntity);
    }
    return null;
  }

  async findLatestBinary(category: string): Promise<BinaryEntity | null> {
    const model = await this.Binary.findOne({ category }).order('id', 'desc');
    if (model) {
      return ModelConvertor.convertModelToEntity(model, BinaryEntity);
    }
    return null;
  }
}
