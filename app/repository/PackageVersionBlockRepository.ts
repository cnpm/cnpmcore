import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { PackageVersionBlock as PackageVersionBlockModel } from './model/PackageVersionBlock';
import { PackageVersionBlock as PackageVersionBlockEntity } from '../core/entity/PackageVersionBlock';
import { AbstractRepository } from './AbstractRepository';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionBlockRepository extends AbstractRepository {
  async savePackageVersionBlock(block: PackageVersionBlockEntity) {
    if (block.id) {
      const model = await PackageVersionBlockModel.findOne({ id: block.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(block, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(block, PackageVersionBlockModel);
      this.logger.info('[PackageVersionBlockRepository:savePackageVersionBlock:new] id: %s, packageVersionBlockId: %s',
        model.id, model.packageVersionBlockId);
    }
  }

  async findPackageBlock(packageId: string) {
    return await this.findPackageVersionBlock(packageId, '*');
  }

  async findPackageVersionBlock(packageId: string, version: string) {
    const model = await PackageVersionBlockModel.findOne({ packageId, version });
    if (model) return ModelConvertor.convertModelToEntity(model, PackageVersionBlockEntity);
    return null;
  }

  async listPackageVersionBlocks(packageId: string) {
    return await PackageVersionBlockModel.find({ packageId });
  }

  async removePackageVersionBlock(packageVersionBlockId: string) {
    const removeCount = await PackageVersionBlockModel.remove({ packageVersionBlockId });
    this.logger.info('[PackageVersionBlockRepository:removePackageVersionBlock:remove] %d rows, packageVersionBlockId: %s',
      removeCount, packageVersionBlockId);
  }
}
