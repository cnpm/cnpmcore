import { Event, Inject } from '@eggjs/tegg';
import {
  EggAppConfig,
} from 'egg';
import { PACKAGE_VERSION_ADDED } from './index.js';
import { getScopeAndName } from '../../common/PackageUtil.js';
import { PackageVersionManifest as PackageVersionManifestEntity } from '../entity/PackageVersionManifest.js';
import { PackageRepository } from '../../repository/PackageRepository.js';
import { DistRepository } from '../../repository/DistRepository.js';

class StoreManifestEvent {
  @Inject()
  protected readonly config: EggAppConfig;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly distRepository: DistRepository;

  protected async savePackageVersionManifest(fullname: string, version: string) {
    if (!this.config.cnpmcore.enableStoreFullPackageVersionManifestsToDatabase) return;

    const [ scope, name ] = getScopeAndName(fullname);
    const packageId = await this.packageRepository.findPackageId(scope, name);
    if (!packageId) return;
    const packageVersion = await this.packageRepository.findPackageVersion(packageId, version);
    if (!packageVersion) return;
    const manifest = await this.distRepository.findPackageVersionManifest(packageId, version);
    if (!manifest) return;
    const entity = PackageVersionManifestEntity.create({
      packageId,
      packageVersionId: packageVersion.packageVersionId,
      manifest,
    });
    await this.packageRepository.savePackageVersionManifest(entity);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAddedStoreManifestEvent extends StoreManifestEvent {
  async handle(fullname: string, version: string) {
    await this.savePackageVersionManifest(fullname, version);
  }
}
