import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';

import { ModelConvertor } from './util/ModelConvertor.js';
import type { PackageVersionFile as PackageVersionFileModel } from './model/PackageVersionFile.js';
import type { Dist as DistModel } from './model/Dist.js';
import { Dist as DistEntity } from '../core/entity/Dist.js';
import { PackageVersionFile as PackageVersionFileEntity } from '../core/entity/PackageVersionFile.js';
import { AbstractRepository } from './AbstractRepository.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionFileRepository extends AbstractRepository {
  @Inject()
  private readonly PackageVersionFile: typeof PackageVersionFileModel;
  @Inject()
  private readonly Dist: typeof DistModel;

  async createPackageVersionFile(file: PackageVersionFileEntity) {
    await this.PackageVersionFile.transaction(async transaction => {
      await Promise.all([
        ModelConvertor.convertEntityToModel(
          file,
          this.PackageVersionFile,
          transaction
        ),
        ModelConvertor.convertEntityToModel(file.dist, this.Dist, transaction),
      ]);
    });
  }

  async findPackageVersionFile(
    packageVersionId: string,
    directory: string,
    name: string
  ) {
    const model = await this.PackageVersionFile.findOne({
      packageVersionId,
      directory,
      name,
    });
    if (!model) return null;
    const distModel = await this.Dist.findOne({ distId: model.distId });
    const dist =
      distModel && ModelConvertor.convertModelToEntity(distModel, DistEntity);
    return ModelConvertor.convertModelToEntity(
      model,
      PackageVersionFileEntity,
      { dist }
    );
  }

  async findPackageVersionFileDists(packageVersionId: string) {
    const fileDists: DistEntity[] = [];
    const queue = ['/'];
    while (queue.length > 0) {
      const directory = queue.shift();
      if (!directory) {
        continue;
      }
      const { files, directories } = await this.listPackageVersionFiles(
        packageVersionId,
        directory
      );
      fileDists.push(...files.map(file => file.dist));
      queue.push(...directories);
    }
    return fileDists;
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
        const subDirectoryName = item.directory
          .slice(prefix.length)
          .split('/')[0];
        subDirectories.add(`${prefix}${subDirectoryName}`);
      }
    }
    const distModels = await this.Dist.find({ distId: distIds });
    const distEntitiesMap = new Map<string, DistEntity>();
    for (const distModel of distModels) {
      const dist = ModelConvertor.convertModelToEntity(distModel, DistEntity);
      distEntitiesMap.set(distModel.distId, dist);
    }
    const files = needModels.map(model => {
      const dist = distEntitiesMap.get(model.distId);
      return ModelConvertor.convertModelToEntity(
        model,
        PackageVersionFileEntity,
        { dist }
      );
    });
    return { files, directories: Array.from(subDirectories) };
  }

  async removePackageVersionFiles(
    packageVersionId: string,
    distIds?: string[]
  ) {
    if (!distIds) {
      const fileDists =
        await this.findPackageVersionFileDists(packageVersionId);
      distIds = fileDists.map(dist => dist.distId);
    }

    await this.PackageVersionFile.transaction(async transaction => {
      const removeCount = await this.PackageVersionFile.remove(
        { packageVersionId },
        true,
        transaction
      );
      this.logger.info(
        '[PackageVersionFileRepository:removePackageVersionFiles:remove] %d rows in PackageVersionFile, packageVersionId: %s',
        removeCount,
        packageVersionId
      );

      if (distIds.length > 0) {
        const distCount = await this.Dist.remove(
          {
            distId: distIds,
          },
          true,
          transaction
        );
        this.logger.info(
          '[PackageVersionFileRepository:removePackageVersionFiles:remove] %d rows in Dist, packageVersionId: %s',
          distCount,
          packageVersionId
        );
      }
    });

    return distIds;
  }

  async hasPackageVersionFiles(packageVersionId: string) {
    const model = await this.PackageVersionFile.findOne({ packageVersionId });
    return !!model;
  }
}
