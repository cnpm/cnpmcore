import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { Package as PackageModel } from './model/Package';
import { Package as PackageEntity } from '../core/entity/Package';
import { ModelConvertor } from './util/ModelConvertor';
import { PackageVersion as PackageVersionEntity } from '../core/entity/PackageVersion';
import { PackageVersion as PackageVersionModel } from './model/PackageVersion';
import { Dist as DistModel } from './model/Dist';
import { Dist as DistEntity } from '../core/entity/Dist';
import { PackageTag as PackageTagEntity } from '../core/entity/PackageTag';
import { PackageTag as PackageTagModel } from './model/PackageTag';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageRepository {
  async createPackage(pkgEntity: PackageEntity) {
    await ModelConvertor.convertEntityToModel(pkgEntity, PackageModel);
  }

  async savePackage(pkgEntity: PackageEntity) {
    if (pkgEntity.id) {
      const model = await PackageModel.findOne({ id: pkgEntity.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(pkgEntity, model);
    } else {
      await ModelConvertor.convertEntityToModel(pkgEntity, PackageModel);
    }
  }

  async saveDist(dist: DistEntity) {
    if (dist.id) {
      const model = await DistModel.findOne({ id: dist.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(dist, model);
    } else {
      await ModelConvertor.convertEntityToModel(dist, DistModel);
    }
  }

  async createPackageVersion(pkgVersionEntity: PackageVersionEntity) {
    await PackageVersionModel.transaction(async function(transaction) {
      await Promise.all([
        ModelConvertor.convertEntityToModel(pkgVersionEntity, PackageVersionModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.manifestDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.tarDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.readmeDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.abbreviatedDist, DistModel, transaction),
      ]);
    });
  }

  async findPackage(scope: string, name: string): Promise<PackageEntity | null> {
    const model = await PackageModel.findOne({ scope, name });
    if (!model) return null;
    const manifestsDistModel = model.manifestsDistId ? await DistModel.findOne({ distId: model.manifestsDistId }) : null;
    const abbreviatedsDistModel = model.abbreviatedsDistId ? await DistModel.findOne({ distId: model.abbreviatedsDistId }) : null;
    const data = {
      manifestsDist: manifestsDistModel && ModelConvertor.convertModelToEntity(manifestsDistModel, DistEntity),
      abbreviatedsDist: abbreviatedsDistModel && ModelConvertor.convertModelToEntity(abbreviatedsDistModel, DistEntity),
    };
    const entity = ModelConvertor.convertModelToEntity(model, PackageEntity, data);
    return entity;
  }

  async findPackageVersion(packageId: string, version: string): Promise<PackageVersionEntity | null> {
    const pkgVersionModel = await PackageVersionModel.findOne({ packageId, version });
    if (!pkgVersionModel) return null;
    return await this.fillPackageVersionEntitiyData(pkgVersionModel);
  }

  async listPackageVersions(packageId: string): Promise<PackageVersionEntity[]> {
    // FIXME: read all versions will hit the memory limit
    const models = await PackageVersionModel.find({ packageId }).order('id desc');
    const entities: PackageVersionEntity[] = [];
    for (const model of models) {
      entities.push(await this.fillPackageVersionEntitiyData(model));
    }
    return entities;
  }

  private async fillPackageVersionEntitiyData(model: PackageVersionModel): Promise<PackageVersionEntity> {
    const [
      tarDistModel,
      readmeDistModel,
      manifestDistModel,
      abbreviatedDistModel,
    ] = await Promise.all([
      DistModel.findOne({ distId: model.tarDistId }),
      DistModel.findOne({ distId: model.readmeDistId }),
      DistModel.findOne({ distId: model.manifestDistId }),
      DistModel.findOne({ distId: model.abbreviatedDistId }),
    ]);
    const data = {
      tarDist: tarDistModel && ModelConvertor.convertModelToEntity(tarDistModel, DistEntity),
      readmeDist: readmeDistModel && ModelConvertor.convertModelToEntity(readmeDistModel, DistEntity),
      manifestDist: manifestDistModel && ModelConvertor.convertModelToEntity(manifestDistModel, DistEntity),
      abbreviatedDist: abbreviatedDistModel && ModelConvertor.convertModelToEntity(abbreviatedDistModel, DistEntity),
    };
    return ModelConvertor.convertModelToEntity(model, PackageVersionEntity, data);
  }

  async findPackageTag(packageId: string, tag: string): Promise<PackageTagEntity | null> {
    const model = await PackageTagModel.findOne({ packageId, tag });
    if (!model) return null;
    const entity = ModelConvertor.convertModelToEntity(model, PackageTagEntity);
    return entity;
  }

  async savePackageTag(packageTagEntity: PackageTagEntity) {
    if (packageTagEntity.id) {
      const packageTagModel = await PackageTagModel.findOne({ id: packageTagEntity.id });
      if (!packageTagModel) return;
      await ModelConvertor.saveEntityToModel(packageTagEntity, packageTagModel);
    } else {
      await ModelConvertor.convertEntityToModel(packageTagEntity, PackageTagModel);
    }
  }

  async listPackageTags(packageId: string): Promise<PackageTagEntity[]> {
    const models = await PackageTagModel.find({ packageId });
    const entities: PackageTagEntity[] = [];
    for (const model of models) {
      entities.push(ModelConvertor.convertModelToEntity(model, PackageTagEntity));
    }
    return entities;
  }
}
