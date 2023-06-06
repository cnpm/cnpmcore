import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { EggLogger } from 'egg';
import pMap from 'p-map';
import { BugVersion } from '../entity/BugVersion';
import { PackageJSONType, PackageRepository } from '../../repository/PackageRepository';
import { DistRepository } from '../../repository/DistRepository';
import { getScopeAndName } from '../../common/PackageUtil';
import { CacheService } from './CacheService';
import { BUG_VERSIONS, LATEST_TAG } from '../../common/constants';
import { BugVersionStore } from '../../common/adapter/BugVersionStore';

@SingletonProto({
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

  @Inject()
  private readonly bugVersionStore: BugVersionStore;

  async getBugVersion(): Promise<BugVersion | undefined> {
    // TODO performance problem, cache bugVersion and update with schedule
    const pkg = await this.packageRepository.findPackage('', BUG_VERSIONS);
    if (!pkg) return;
    /* c8 ignore next 10 */
    const tag = await this.packageRepository.findPackageTag(pkg!.packageId, LATEST_TAG);
    if (!tag) return;
    let bugVersion = this.bugVersionStore.getBugVersion(tag!.version);
    if (!bugVersion) {
      const packageVersionJson = (await this.distRepository.findPackageVersionManifest(pkg!.packageId, tag!.version)) as PackageJSONType;
      if (!packageVersionJson) return;
      const data = packageVersionJson.config?.['bug-versions'];
      bugVersion = new BugVersion(data);
      this.bugVersionStore.setBugVersion(bugVersion, tag!.version);
    }
    return bugVersion;
  }

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
    // If package all version unpublished(like pinyin-tool), versions is undefined
    if (!manifests) return;
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
