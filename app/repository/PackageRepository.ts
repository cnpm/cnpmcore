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

type Scope = string | null | undefined;

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

  async createPackageVersion(pkgVersionEntity: PackageVersionEntity) {
    await PackageVersionModel.transaction(async function(transaction) {
      const [
        pkgVersionModel,
        manifestDistModel,
        tarDistModel,
        readmeDistModel,
        abbreviatedDistModel,
      ] = await Promise.all([
        ModelConvertor.convertEntityToModel(pkgVersionEntity, PackageVersionModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.manifestDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.tarDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.readmeDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.abbreviatedDist, DistModel, transaction),
      ]);
      pkgVersionEntity.id = pkgVersionModel.id;
      pkgVersionEntity.tarDist.id = tarDistModel.id;
      pkgVersionEntity.manifestDist.id = manifestDistModel.id;
      pkgVersionEntity.readmeDist.id = readmeDistModel.id;
      pkgVersionEntity.abbreviatedDist.id = abbreviatedDistModel.id;
    });
  }

  async findPackage(scope: Scope, name: string): Promise<PackageEntity | null> {
    const model = await PackageModel.findOne({ scope, name });
    if (!model) return null;
    const entity = ModelConvertor.convertModelToEntity(model, PackageEntity);
    return entity;
  }

  async findPackageVersion(packageId: string, version: string): Promise<PackageVersionEntity | null> {
    const pkgVersionModel = await PackageVersionModel.findOne({ packageId, version });
    if (!pkgVersionModel) return null;
    const [
      tarDistModel,
      readmeDistModel,
      manifestDistModel,
      abbreviatedDistModel,
    ] = await Promise.all([
      DistModel.findOne({ distId: pkgVersionModel.tarDistId }),
      DistModel.findOne({ distId: pkgVersionModel.readmeDistId }),
      DistModel.findOne({ distId: pkgVersionModel.manifestDistId }),
      DistModel.findOne({ distId: pkgVersionModel.abbreviatedDistId }),
    ]);
    const data = {
      tarDist: ModelConvertor.convertModelToEntity(tarDistModel!, DistEntity),
      readmeDist: ModelConvertor.convertModelToEntity(readmeDistModel!, DistEntity),
      manifestDist: ModelConvertor.convertModelToEntity(manifestDistModel!, DistEntity),
      abbreviatedDist: ModelConvertor.convertModelToEntity(abbreviatedDistModel!, DistEntity),
    };
    const pkgVersionEntity = ModelConvertor.convertModelToEntity(pkgVersionModel, PackageVersionEntity, data);
    return pkgVersionEntity;
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
}
