import { Event, Inject } from '@eggjs/tegg';
import {
  EggAppConfig,
} from 'egg';
import { PACKAGE_VERSION_ADDED, PACKAGE_TAG_ADDED, PACKAGE_TAG_CHANGED } from './index';
import { getScopeAndName } from '../../common/PackageUtil';
import { PackageManagerService } from '../service/PackageManagerService';
import { PackageVersionFileService } from '../service/PackageVersionFileService';

class SyncPackageVersionFileEvent {
  @Inject()
  protected readonly config: EggAppConfig;
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly packageVersionFileService: PackageVersionFileService;

  protected async syncPackageVersionFile(fullname: string, version: string) {
    if (!this.config.cnpmcore.enableUnpkg) return;
    // ignore sync on unittest
    if (this.config.env === 'unittest' && fullname !== '@cnpm/unittest-unpkg-demo') return;
    const [ scope, name ] = getScopeAndName(fullname);
    const { packageVersion } = await this.packageManagerService.showPackageVersionByVersionOrTag(
      scope, name, version);
    if (!packageVersion) return;
    await this.packageVersionFileService.syncPackageVersionFiles(packageVersion);
  }

  protected async syncPackageReadmeToLatestVersion(fullname: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    const { pkg, packageVersion } = await this.packageManagerService.showPackageVersionByVersionOrTag(
      scope, name, 'latest');
    if (!pkg || !packageVersion) return;
    await this.packageVersionFileService.syncPackageReadme(pkg, packageVersion);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends SyncPackageVersionFileEvent {
  async handle(fullname: string, version: string) {
    await this.syncPackageVersionFile(fullname, version);
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends SyncPackageVersionFileEvent {
  async handle(fullname: string, tag: string) {
    if (tag !== 'latest') return;
    await this.syncPackageReadmeToLatestVersion(fullname);
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends SyncPackageVersionFileEvent {
  async handle(fullname: string, tag: string) {
    if (tag !== 'latest') return;
    await this.syncPackageReadmeToLatestVersion(fullname);
  }
}
