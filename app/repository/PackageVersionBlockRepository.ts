import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { PackageVersionBlock as PackageVersionBlockModel } from './model/PackageVersionBlock';
import { PackageVersionBlock as PackageVersionBlockEntity } from '../core/entity/PackageVersionBlock';
import { AbstractRepository } from './AbstractRepository';

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
      const model = await ModelConvertor.convertEntityToModel(block, this.PackageVersionBlock);
      this.logger.info('[PackageVersionBlockRepository:savePackageVersionBlock:new] id: %s, packageVersionBlockId: %s',
        model.id, model.packageVersionBlockId);
    }
  }

  async findPackageBlock(packageId: string) {
    return await this.findPackageVersionBlock(packageId, '*');
  }

  async findPackageVersionBlock(packageId: string, version: string) {
    const model = await this.PackageVersionBlock.findOne({ packageId, version });
    if (model) return ModelConvertor.convertModelToEntity(model, PackageVersionBlockEntity);
    return null;
  }

  async listPackageVersionBlocks(packageId: string) {
    return await this.PackageVersionBlock.find({ packageId });
  }

  async removePackageVersionBlock(packageVersionBlockId: string) {
    const removeCount = await this.PackageVersionBlock.remove({ packageVersionBlockId });
    this.logger.info('[PackageVersionBlockRepository:removePackageVersionBlock:remove] %d rows, packageVersionBlockId: %s',
      removeCount, packageVersionBlockId);
  }

  // Find a specific version block (not '*')
  async findPackageVersionBlockExact(packageId: string, version: string) {
    const model = await this.PackageVersionBlock.findOne({ packageId, version });
    if (model) return ModelConvertor.convertModelToEntity(model, PackageVersionBlockEntity);
    return null;
  }

  // Check if a version is blocked (including package-level block)
  async isVersionBlocked(packageId: string, version: string): Promise<{
    blocked: boolean;
    reason?: string;
    version?: string;
  }> {
    // First check package-level block (version='*')
    const packageBlock = await this.findPackageBlock(packageId);
    if (packageBlock) {
      return {
        blocked: true,
        reason: packageBlock.reason,
        version: '*',
      };
    }

    // Then check version-level block
    const versionBlock = await this.findPackageVersionBlockExact(packageId, version);
    if (versionBlock) {
      return {
        blocked: true,
        reason: versionBlock.reason,
        version: versionBlock.version,
      };
    }

    return { blocked: false };
  }

  // List all blocked versions (exclude '*')
  async listBlockedVersions(packageId: string) {
    const models = await this.PackageVersionBlock.find({
      packageId,
      version: { $ne: '*' },
    });
    return models.map(model => ModelConvertor.convertModelToEntity(model, PackageVersionBlockEntity));
  }
}
