import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';

import { ModelConvertor } from './util/ModelConvertor.ts';
import type { PackageVersionBlock as PackageVersionBlockModel } from './model/PackageVersionBlock.ts';
import { PackageVersionBlock as PackageVersionBlockEntity } from '../core/entity/PackageVersionBlock.ts';
import { AbstractRepository } from './AbstractRepository.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionBlockRepository extends AbstractRepository {
  @Inject()
  private readonly PackageVersionBlock: typeof PackageVersionBlockModel;

  async savePackageVersionBlock(block: PackageVersionBlockEntity) {
    if (block.id) {
      const model = await this.PackageVersionBlock.findOne({ id: block.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(block, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(
        block,
        this.PackageVersionBlock
      );
      this.logger.info(
        '[PackageVersionBlockRepository:savePackageVersionBlock:new] id: %s, packageVersionBlockId: %s',
        model.id,
        model.packageVersionBlockId
      );
    }
  }

  async findPackageBlock(packageId: string) {
    return await this.findPackageVersionBlock(packageId, '*');
  }

  async findPackageVersionBlock(packageId: string, version: string) {
    const model = await this.PackageVersionBlock.findOne({
      packageId,
      version,
    });
    if (model)
      return ModelConvertor.convertModelToEntity(
        model,
        PackageVersionBlockEntity
      );
    return null;
  }

  async listPackageVersionBlocks(packageId: string) {
    return await this.PackageVersionBlock.find({ packageId });
  }

  async removePackageVersionBlock(packageVersionBlockId: string) {
    const removeCount = await this.PackageVersionBlock.remove({
      packageVersionBlockId,
    });
    this.logger.info(
      '[PackageVersionBlockRepository:removePackageVersionBlock:remove] %d rows, packageVersionBlockId: %s',
      removeCount,
      packageVersionBlockId
    );
  }
}
