import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { EggLogger } from 'egg';
import pMap from 'p-map';
import { BugVersion } from '../entity/BugVersion';
import { PackageRepository } from '../../repository/PackageRepository';
import { DistRepository } from '../../repository/DistRepository';
import { getScopeAndName } from '../../common/PackageUtil';
import { CacheService } from './CacheService';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BugVersionService {
  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly distRepository: DistRepository;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly cacheService: CacheService;

  async cleanBugVersionPackageCaches(bugVersion: BugVersion) {
    const fullnames = bugVersion.listAllPackagesHasBugs();
    await pMap(fullnames, async fullname => {
      await this.cacheService.removeCache(fullname);
    }, {
      concurrency: 50,
      stopOnError: false,
    });
  }

  async fixPackageBugVersions(bugVersion: BugVersion, fullname: string, manifests: Record<string, any>) {
    for (const manifest of Object.values(manifests)) {
      this.fixPackageBugVersionWithAllVersions(fullname, bugVersion, manifest, manifests);
    }
  }

  async fixPackageBugVersion(bugVersion: BugVersion, fullname: string, manifest: any) {
    const advice = bugVersion.fixVersion(fullname, manifest.version);
    if (!advice) {
      return manifest;
    }
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      return manifest;
    }
    const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, advice.version);
    if (!packageVersion) {
      return manifest;
    }
    const fixedManifest = await this.distRepository.findPackageVersionManifest(packageVersion.packageId, advice.version);
    if (!fixedManifest) {
      return manifest;
    }
    return bugVersion.fixManifest(manifest, fixedManifest);
  }

  private fixPackageBugVersionWithAllVersions(fullname: string, bugVersion: BugVersion, manifest: any, manifests: Record<string, any>) {
    const advice = bugVersion.fixVersion(fullname, manifest.version);
    if (!advice) {
      return;
    }
    const fixedManifest = manifests[advice.version];
    if (!fixedManifest) {
      this.logger.warn('[BugVersionService] not found pkg for %s@%s manifest', fullname, advice.version);
      return;
    }
    const newManifest = bugVersion.fixManifest(manifest, fixedManifest);
    manifests[manifest.version] = newManifest;
  }
}
