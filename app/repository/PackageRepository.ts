import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { Package as PackageModel } from './model/Package';
import { Package as PackageEntity } from '../core/entity/Package';
import { ModelConvertor } from './util/ModelConvertor';
import { PackageVersion as PackageVersionEntity } from '../core/entity/PackageVersion';
import { PackageVersion as PackageVersionModel } from './model/PackageVersion';
import { Dist as DistModel } from './model/Dist';
import { Dist as DistEntity } from '../core/entity/Dist';

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

  async findPackageVersion(scope: string | null, name: string, version: string): Promise<PackageVersionEntity | null> {
    const pkg = await PackageModel.findOne({ scope, name }) as PackageModel;
    if (!pkg) return null;
    const pkgVersionModel = await PackageVersionModel.findOne({
      packageId: pkg.packageId,
      version,
    }) as PackageVersionModel;
    if (!pkgVersionModel) return null;
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
}
