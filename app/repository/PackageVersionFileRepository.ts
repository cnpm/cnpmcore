import { AccessLevel, Inject, SingletonProto } from 'egg';

import { Dist as DistEntity } from '../core/entity/Dist.ts';
import { PackageVersionFile as PackageVersionFileEntity } from '../core/entity/PackageVersionFile.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import type { Dist as DistModel } from './model/Dist.ts';
import type { PackageVersionFile as PackageVersionFileModel } from './model/PackageVersionFile.ts';
import { ModelConvertor } from './util/ModelConvertor.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionFileRepository extends AbstractRepository {
  @Inject()
  private readonly PackageVersionFile: typeof PackageVersionFileModel;
  @Inject()
  private readonly Dist: typeof DistModel;

  async createPackageVersionFile(file: PackageVersionFileEntity) {
    await this.PackageVersionFile.transaction(async (transaction) => {
      await Promise.all([
        ModelConvertor.convertEntityToModel(file, this.PackageVersionFile, transaction),
        ModelConvertor.convertEntityToModel(file.dist, this.Dist, transaction),
      ]);
    });
  }

  async findPackageVersionFile(packageVersionId: string, directory: string, name: string) {
    const model = await this.PackageVersionFile.findOne({
      packageVersionId,
      directory,
      name,
    });
    if (!model) return null;
    const distModel = await this.Dist.findOne({ distId: model.distId });
    const dist = distModel && ModelConvertor.convertModelToEntity(distModel, DistEntity);
    return ModelConvertor.convertModelToEntity(model, PackageVersionFileEntity, { dist });
  }

  async listPackageVersionFiles(packageVersionId: string, directory: string) {
    const isRoot = directory === '/';
    const where = isRoot
      ? { packageVersionId }
      : {
          packageVersionId,
          directory: { $or: [{ $eq: directory }, { $like: `${directory}/%` }] },
        };
    // only return current directory's files and directories
    // https://github.com/cnpm/cnpmcore/issues/680
    const models = await this.PackageVersionFile.find(where);
    const distIds: string[] = [];
    const prefix = isRoot ? directory : `${directory}/`;
    const subDirectories = new Set<string>();
    const needModels: PackageVersionFileModel[] = [];
    for (const item of models) {
      if (item.directory === directory) {
        // sub file
        distIds.push(item.distId);
        needModels.push(item);
      } else {
        // only keep directory = '/' or sub directory like `/dist` but not `/dist/foo`
        // sub directory
        const subDirectoryName = item.directory.slice(prefix.length).split('/')[0];
        subDirectories.add(`${prefix}${subDirectoryName}`);
      }
    }
    const distModels = await this.Dist.find({ distId: distIds });
    const distEntitiesMap = new Map<string, DistEntity>();
    for (const distModel of distModels) {
      const dist = ModelConvertor.convertModelToEntity(distModel, DistEntity);
      distEntitiesMap.set(distModel.distId, dist);
    }
    const files = needModels.map((model) => {
      const dist = distEntitiesMap.get(model.distId);
      return ModelConvertor.convertModelToEntity(model, PackageVersionFileEntity, { dist });
    });
    return { files, directories: Array.from(subDirectories) };
  }

  async hasPackageVersionFiles(packageVersionId: string) {
    const model = await this.PackageVersionFile.findOne({ packageVersionId });
    return !!model;
  }

  async removePackageVersionFiles(packageVersionId: string): Promise<{ distPaths: string[]; removeCount: number }> {
    // 1. Find all PackageVersionFile records for this version
    const models = await this.PackageVersionFile.find({ packageVersionId });
    if (models.length === 0) {
      return { distPaths: [], removeCount: 0 };
    }

    // 2. Collect distIds and get dist paths for NFS cleanup
    const distIds = models.map((m) => m.distId);
    const distModels = await this.Dist.find({ distId: distIds });
    const distPaths = distModels.map((d) => d.path);

    // 3. Delete in transaction
    await this.PackageVersionFile.transaction(async ({ connection }) => {
      await this.PackageVersionFile.remove({ packageVersionId }, true, { connection });
      if (distIds.length > 0) {
        await this.Dist.remove({ distId: distIds }, true, { connection });
      }
    });

    this.logger.info(
      '[PackageVersionFileRepository:removePackageVersionFiles:remove] %d files, %d dists, packageVersionId: %s',
      models.length,
      distIds.length,
      packageVersionId,
    );

    return { distPaths, removeCount: models.length };
  }
}
