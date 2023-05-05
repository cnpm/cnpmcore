import { Event, Inject } from '@eggjs/tegg';
import {
  EggAppConfig,
} from 'egg';
import { PACKAGE_VERSION_ADDED } from './index';
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
    const [ scope, name ] = getScopeAndName(fullname);
    const { packageVersion } = await this.packageManagerService.showPackageVersionByVersionOrTag(
      scope, name, version);
    if (!packageVersion) return;
    await this.packageVersionFileService.syncPackageVersionFiles(packageVersion);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends SyncPackageVersionFileEvent {
  async handle(fullname: string, version: string) {
    await this.syncPackageVersionFile(fullname, version);
  }
}
