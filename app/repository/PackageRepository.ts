import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import type { Package as PackageModel } from './model/Package';
import { Package as PackageEntity } from '../core/entity/Package';
import { ModelConvertor } from './util/ModelConvertor';
import { PackageVersion as PackageVersionEntity } from '../core/entity/PackageVersion';
import type { PackageVersion as PackageVersionModel } from './model/PackageVersion';
import { PackageVersionManifest as PackageVersionManifestEntity } from '../core/entity/PackageVersionManifest';
import type { PackageVersionManifest as PackageVersionManifestModel } from './model/PackageVersionManifest';
import type { Dist as DistModel } from './model/Dist';
import { Dist as DistEntity } from '../core/entity/Dist';
import { PackageTag as PackageTagEntity } from '../core/entity/PackageTag';
import type { PackageTag as PackageTagModel } from './model/PackageTag';
import type { Maintainer as MaintainerModel } from './model/Maintainer';
import type { User as UserModel } from './model/User';
import { User as UserEntity } from '../core/entity/User';
import { AbstractRepository } from './AbstractRepository';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageRepository extends AbstractRepository {
  @Inject()
  private readonly Package: typeof PackageModel;

  @Inject()
  private readonly Dist: typeof DistModel;

  @Inject()
  private readonly PackageVersion: typeof PackageVersionModel;

  @Inject()
  private readonly PackageVersionManifest: typeof PackageVersionManifestModel;

  @Inject()
  private readonly PackageTag: typeof PackageTagModel;

  @Inject()
  private readonly Maintainer: typeof MaintainerModel;

  @Inject()
  private readonly User: typeof UserModel;

  async findPackage(scope: string, name: string): Promise<PackageEntity | null> {
    const model = await this.Package.findOne({ scope, name });
    if (!model) return null;
    const manifestsDistModel = model.manifestsDistId ? await this.Dist.findOne({ distId: model.manifestsDistId }) : null;
    const abbreviatedsDistModel = model.abbreviatedsDistId ? await this.Dist.findOne({ distId: model.abbreviatedsDistId }) : null;
    const data = {
      manifestsDist: manifestsDistModel && ModelConvertor.convertModelToEntity(manifestsDistModel, DistEntity),
      abbreviatedsDist: abbreviatedsDistModel && ModelConvertor.convertModelToEntity(abbreviatedsDistModel, DistEntity),
    };
    const entity = ModelConvertor.convertModelToEntity(model, PackageEntity, data);
    return entity;
  }

  async findPackageId(scope: string, name: string) {
    const model = await this.Package.findOne({ scope, name }).select('packageId');
    if (!model) return null;
    return model.packageId;
  }

  async savePackage(pkgEntity: PackageEntity): Promise<void> {
    if (pkgEntity.id) {
      const model = await this.Package.findOne({ id: pkgEntity.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(pkgEntity, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(pkgEntity, this.Package);
      this.logger.info('[PackageRepository:savePackage:new] id: %s, packageId: %s', model.id, model.packageId);
    }
  }

  async savePackageDist(pkgEntity: PackageEntity, isFullManifests: boolean): Promise<void> {
    const dist = isFullManifests ? pkgEntity.manifestsDist : pkgEntity.abbreviatedsDist;
    if (!dist) return;
    if (dist.id) {
      const model = await this.Dist.findOne({ id: dist.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(dist, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(dist, this.Dist);
      this.logger.info('[PackageRepository:savePackageDist:new] id: %s, distId: %s, packageId: %s',
        model.id, model.distId, pkgEntity.packageId);
    }
    await this.savePackage(pkgEntity);
  }

  async removePackageDist(pkgEntity: PackageEntity, isFullManifests: boolean): Promise<void> {
    const dist = isFullManifests ? pkgEntity.manifestsDist : pkgEntity.abbreviatedsDist;
    if (!dist) return;
    const model = await this.Dist.findOne({ id: dist.id });
    if (!model) return;
    await model.remove();
    this.logger.info('[PackageRepository:removePackageDist:remove] id: %s, distId: %s, packageId: %s',
      model.id, model.distId, pkgEntity.packageId);
    Reflect.set(dist, 'distId', null);
    await this.savePackage(pkgEntity);
  }

  // Package Maintainers
  // return true meaning create new record
  async savePackageMaintainer(packageId: string, userId: string): Promise<undefined | true> {
    let model = await this.Maintainer.findOne({ packageId, userId });
    if (!model) {
      model = await this.Maintainer.create({ packageId, userId });
      this.logger.info('[PackageRepository:addPackageMaintainer:new] id: %s, packageId: %s, userId: %s',
        model.id, model.packageId, model.userId);
      return true;
    }
  }

  async listPackageMaintainers(packageId: string): Promise<UserEntity[]> {
    const models = await this.Maintainer.find({ packageId });
    const userModels = await this.User.find({ userId: models.map(m => m.userId) });
    return userModels.map(user => ModelConvertor.convertModelToEntity(user, UserEntity));
  }

  async replacePackageMaintainers(packageId: string, userIds: string[]): Promise<void> {
    await this.Maintainer.transaction(async ({ connection }) => {
      // delete exists
      // const removeCount = await this.Maintainer.remove({ packageId }, true, { transaction });
      const removeCount = await this.Maintainer.remove({ packageId }, true, { connection });
      this.logger.info('[PackageRepository:replacePackageMaintainers:remove] %d rows, packageId: %s',
        removeCount, packageId);
      // add news
      for (const userId of userIds) {
        // const model = await this.Maintainer.create({ packageId, userId }, transaction);
        const model = await this.Maintainer.create({ packageId, userId }, { connection });
        this.logger.info('[PackageRepository:replacePackageMaintainers:new] id: %s, packageId: %s, userId: %s',
          model.id, model.packageId, model.userId);
      }
    });
  }

  async removePackageMaintainer(packageId: string, userId: string) {
    const model = await this.Maintainer.findOne({ packageId, userId });
    if (model) {
      await model.remove();
      this.logger.info('[PackageRepository:removePackageMaintainer:remove] id: %s, packageId: %s, userId: %s',
        model.id, model.packageId, model.userId);
      return true;
    }
    return false;
  }

  // TODO: support paging
  async listPackagesByUserId(userId: string): Promise<PackageEntity[]> {
    const models = await this.Maintainer.find({ userId });
    const packageModels = await this.Package.find({ packageId: models.map(m => m.packageId) });
    return packageModels.map(pkg => ModelConvertor.convertModelToEntity(pkg, PackageEntity));
  }

  async createPackageVersion(pkgVersionEntity: PackageVersionEntity) {
    await this.PackageVersion.transaction(async transaction => {
      await Promise.all([
        // FIXME: transaction is not the options
        ModelConvertor.convertEntityToModel(pkgVersionEntity, this.PackageVersion, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.manifestDist, this.Dist, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.tarDist, this.Dist, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.readmeDist, this.Dist, transaction),
        ModelConvertor.convertEntityToModel(pkgVersionEntity.abbreviatedDist, this.Dist, transaction),
      ]);
    });
  }

  async savePackageVersion(pkgVersionEntity: PackageVersionEntity) {
    // only abbreviatedDist and manifestDist allow to change, like `deprecated` message
    let model = await this.Dist.findOne({ id: pkgVersionEntity.manifestDist.id });
    if (model) {
      await ModelConvertor.saveEntityToModel(pkgVersionEntity.manifestDist, model);
    }
    model = await this.Dist.findOne({ id: pkgVersionEntity.abbreviatedDist.id });
    if (model) {
      await ModelConvertor.saveEntityToModel(pkgVersionEntity.abbreviatedDist, model);
    }
    if (pkgVersionEntity.id) {
      const model = await this.PackageVersion.findOne({ id: pkgVersionEntity.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(pkgVersionEntity, model);
      }
    }
  }

  async findPackageVersion(packageId: string, version: string): Promise<PackageVersionEntity | null> {
    const pkgVersionModel = await this.PackageVersion.findOne({ packageId, version });
    if (!pkgVersionModel) return null;
    return await this.fillPackageVersionEntitiyData(pkgVersionModel);
  }

  async listPackageVersions(packageId: string): Promise<PackageVersionEntity[]> {
    // FIXME: read all versions will hit the memory limit
    const models = await this.PackageVersion.find({ packageId }).order('id desc');
    const entities: PackageVersionEntity[] = [];
    for (const model of models) {
      entities.push(await this.fillPackageVersionEntitiyData(model));
    }
    return entities;
  }

  async listPackageVersionNames(packageId: string): Promise<string[]> {
    const rows = await this.PackageVersion.find({ packageId }).select('version').order('id desc');
    return rows.map(row => row.version);
  }

  // only for unittest now
  async removePackageVersions(packageId: string): Promise<void> {
    const removeCount = await this.PackageVersion.remove({ packageId });
    this.logger.info('[PackageRepository:removePackageVersions:remove] %d rows, packageId: %s',
      removeCount, packageId);
  }

  async removePackageVersion(pkgVersion: PackageVersionEntity): Promise<void> {
    const distRemoveCount = await this.Dist.remove({
      distId: [
        pkgVersion.abbreviatedDist.distId,
        pkgVersion.manifestDist.distId,
        pkgVersion.readmeDist.distId,
        pkgVersion.tarDist.distId,
      ],
    });
    const removeCount = await this.PackageVersion.remove({ packageVersionId: pkgVersion.packageVersionId });
    this.logger.info('[PackageRepository:removePackageVersion:remove] %d dist rows, %d rows, packageVersionId: %s',
      distRemoveCount, removeCount, pkgVersion.packageVersionId);
  }

  async savePackageVersionManifest(manifestEntity: PackageVersionManifestEntity): Promise<void> {
    let model = await this.PackageVersionManifest.findOne({ packageVersionId: manifestEntity.packageVersionId });
    if (model) {
      model.manifest = manifestEntity.manifest;
      await model.save();
    } else {
      model = await ModelConvertor.convertEntityToModel(manifestEntity, this.PackageVersionManifest);
      this.logger.info('[PackageRepository:savePackageVersionManifest:new] id: %s, packageVersionId: %s',
        model.id, model.packageVersionId);
    }
  }

  async findPackageVersionManifest(packageVersionId: string) {
    const model = await this.PackageVersionManifest.findOne({ packageVersionId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, this.PackageVersionManifest);
  }

  public async queryTotal() {
    const lastPkg = await this.Package.findOne().order('id', 'desc');
    const lastVersion = await this.PackageVersion.findOne().order('id', 'desc');
    let packageCount = 0;
    let packageVersionCount = 0;
    let lastPackage = '';
    let lastPackageVersion = '';

    if (lastPkg) {
      lastPackage = lastPkg.scope ? `${lastPkg.scope}/${lastPkg.name}` : lastPkg.name;
      // FIXME: id will be out of range number
      packageCount = Number(lastPkg.id);
    }

    if (lastVersion) {
      const pkg = await this.Package.findOne({ packageId: lastVersion.packageId });
      if (pkg) {
        const fullname = pkg.scope ? `${pkg.scope}/${pkg.name}` : pkg.name;
        lastPackageVersion = `${fullname}@${lastVersion.version}`;
      }
      packageVersionCount = Number(lastVersion.id);
    }
    return {
      packageCount,
      packageVersionCount,
      lastPackage,
      lastPackageVersion,
    };
  }

  private async fillPackageVersionEntitiyData(model: PackageVersionModel): Promise<PackageVersionEntity> {
    const [
      tarDistModel,
      readmeDistModel,
      manifestDistModel,
      abbreviatedDistModel,
    ] = await Promise.all([
      this.Dist.findOne({ distId: model.tarDistId }),
      this.Dist.findOne({ distId: model.readmeDistId }),
      this.Dist.findOne({ distId: model.manifestDistId }),
      this.Dist.findOne({ distId: model.abbreviatedDistId }),
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
    const model = await this.PackageTag.findOne({ packageId, tag });
    if (!model) return null;
    const entity = ModelConvertor.convertModelToEntity(model, PackageTagEntity);
    return entity;
  }

  async savePackageTag(packageTagEntity: PackageTagEntity) {
    if (packageTagEntity.id) {
      const model = await this.PackageTag.findOne({ id: packageTagEntity.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(packageTagEntity, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(packageTagEntity, this.PackageTag);
      this.logger.info('[PackageRepository:savePackageTag:new] id: %s, packageTagId: %s, tags: %s => %s',
        model.id, model.packageTagId, model.tag, model.version);
    }
  }

  async removePackageTag(packageTagEntity: PackageTagEntity) {
    const model = await this.PackageTag.findOne({ id: packageTagEntity.id });
    if (!model) return;
    await model.remove();
    this.logger.info('[PackageRepository:removePackageTag:remove] id: %s, packageTagId: %s, packageId: %s',
      model.id, model.packageTagId, model.packageId);
  }

  async listPackageTags(packageId: string): Promise<PackageTagEntity[]> {
    const models = await this.PackageTag.find({ packageId });
    const entities: PackageTagEntity[] = [];
    for (const model of models) {
      entities.push(ModelConvertor.convertModelToEntity(model, PackageTagEntity));
    }
    return entities;
  }
}
