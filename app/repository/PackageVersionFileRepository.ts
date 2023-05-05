import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { PackageVersionFile as PackageVersionFileModel } from './model/PackageVersionFile';
import type { Dist as DistModel } from './model/Dist';
import { Dist as DistEntity } from '../core/entity/Dist';
import { PackageVersionFile as PackageVersionFileEntity } from '../core/entity/PackageVersionFile';
import { AbstractRepository } from './AbstractRepository';

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
        ModelConvertor.convertEntityToModel(file, this.PackageVersionFile, transaction),
        ModelConvertor.convertEntityToModel(file.dist, this.Dist, transaction),
      ]);
    });
  }

  async findPackageVersionFile(packageVersionId: string, directory: string, name: string) {
    const model = await this.PackageVersionFile.findOne({ packageVersionId, directory, name });
    if (!model) return null;
    const distModel = await this.Dist.findOne({ distId: model.distId });
    const dist = distModel && ModelConvertor.convertModelToEntity(distModel, DistEntity);
    return ModelConvertor.convertModelToEntity(model, PackageVersionFileEntity, { dist });
  }

  async listPackageVersionFiles(packageVersionId: string, directory: string) {
    const where = directory === '/' ? { packageVersionId } :
      { packageVersionId, directory: { $or: [{ $eq: directory }, { $like: `${directory}/%` }] } };
    const models = await this.PackageVersionFile.find(where);
    const distIds = models.map(model => model.distId);
    const distModels = await this.Dist.find({ distId: distIds });
    const distEntitiesMap = new Map<string, DistEntity>();
    for (const distModel of distModels) {
      const dist = ModelConvertor.convertModelToEntity(distModel, DistEntity);
      distEntitiesMap.set(distModel.distId, dist);
    }
    return models.map(model => {
      const dist = distEntitiesMap.get(model.distId);
      return ModelConvertor.convertModelToEntity(model, PackageVersionFileEntity, { dist });
    });
  }

  async hasPackageVersionFiles(packageVersionId: string) {
    const model = await this.PackageVersionFile.findOne({ packageVersionId });
    return !!model;
  }
}
