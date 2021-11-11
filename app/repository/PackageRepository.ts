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
    const pkgModel = await ModelConvertor.convertEntityToModel(pkgEntity, PackageModel);
    await pkgModel.save();
  }

  async createPackageVersion(pkgVersionEntity: PackageVersionEntity) {
    await PackageVersionModel.transaction(async function(transaction) {
      const [
        pkgVersionModel,
        manifestDistModel,
        tarDistModel,
        readmeDistModel,
      ] = await Promise.all([
        ModelConvertor.convertEntityToModel(pkgVersionEntity, PackageVersionModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.manifestDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.tarDist, DistModel, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.readmeDist, DistModel, transaction),
      ]);
      pkgVersionEntity.id = pkgVersionModel.id;
      pkgVersionEntity.tarDist.id = tarDistModel.id;
      pkgVersionEntity.manifestDist.id = manifestDistModel.id;
      pkgVersionEntity.readmeDist.id = readmeDistModel.id;
    });
  }

  async savePackageTag(packageTagEntity: PackageTagEntity) {
    let packageTagModel = await PackageTagModel.findOne({ packageId: packageTagEntity.packageId, tag: packageTagEntity.tag }) as PackageTagModel;
    if (packageTagModel) {
      packageTagModel.version = packageTagEntity.version;
      packageTagModel.gmtCreate = packageTagEntity.gmtModified;
    } else {
      packageTagModel = await ModelConvertor.convertEntityToModel(packageTagEntity, PackageTagModel);
    }
    await packageTagModel.save();
  }

  async findPackage(scope: Scope, name: string): Promise<PackageEntity | undefined> {
    const model = await PackageModel.findOne({ scope, name }) as PackageModel;
    if (!model) return;
    const entity = ModelConvertor.convertModelToEntity(model, PackageEntity);
    return entity;
  }

  async findPackageVersion(scope: Scope, name: string, version: string): Promise<PackageVersionEntity | undefined> {
    const pkg = await PackageModel.findOne({ scope, name }) as PackageModel;
    if (!pkg) return;
    const pkgVersionModel = await PackageVersionModel.findOne({
      packageId: pkg.packageId,
      version,
    }) as PackageVersionModel;
    if (!pkgVersionModel) return;
    const [
      tarDistModel,
      readmeDistModel,
      manifestDistModel,
    ] = await Promise.all([
      DistModel.findOne({ distId: pkgVersionModel.tarDistId }),
      DistModel.findOne({ distId: pkgVersionModel.readmeDistId }),
      DistModel.findOne({ distId: pkgVersionModel.manifestDistId }),
    ]);
    const data = {
      tarDist: ModelConvertor.convertModelToEntity(tarDistModel!, DistEntity),
      readmeDist: ModelConvertor.convertModelToEntity(readmeDistModel!, DistEntity),
      manifestDist: ModelConvertor.convertModelToEntity(manifestDistModel!, DistEntity),
    };
    const pkgVersionEntity = ModelConvertor.convertModelToEntity(pkgVersionModel, PackageVersionEntity, data);
    return pkgVersionEntity;
  }

  async findPackageTag(scope: Scope, name: string, tag: string): Promise<PackageTagEntity | undefined> {
    const pkgModel = await PackageModel.findOne({ scope, name }) as PackageModel;
    if (!pkgModel) return;

    const tagModel = await PackageTagModel.findOne({ packageId: pkgModel.packageId, tag }) as PackageTagModel;
    if (!tagModel) return;
    const tagEntity = ModelConvertor.convertModelToEntity(tagModel, PackageTagEntity);
    return tagEntity;
  }
}
