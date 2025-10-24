import { Config, Event, Inject } from 'egg';

import { PACKAGE_VERSION_ADDED } from './index.ts';
import { getScopeAndName } from '../../common/PackageUtil.ts';
import { PackageVersionManifest as PackageVersionManifestEntity } from '../entity/PackageVersionManifest.ts';
import type { PackageRepository } from '../../repository/PackageRepository.ts';
import type { DistRepository } from '../../repository/DistRepository.ts';

class StoreManifestEvent {
  @Inject()
  protected readonly config: Config;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly distRepository: DistRepository;

  protected async savePackageVersionManifest(
    fullname: string,
    version: string
  ) {
    if (!this.config.cnpmcore.enableStoreFullPackageVersionManifestsToDatabase)
      return;

    const [scope, name] = getScopeAndName(fullname);
    const packageId = await this.packageRepository.findPackageId(scope, name);
    if (!packageId) return;
    const packageVersion = await this.packageRepository.findPackageVersion(
      packageId,
      version
    );
    if (!packageVersion) return;
    const manifest = await this.distRepository.findPackageVersionManifest(
      packageId,
      version
    );
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
