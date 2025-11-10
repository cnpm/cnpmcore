import { AccessLevel, Inject, SingletonProto, Logger } from 'egg';
import pMap from 'p-map';
import { BugVersion } from '../entity/BugVersion.ts';
import type {
  AbbreviatedPackageJSONType,
  PackageJSONType,
  PackageRepository,
} from '../../repository/PackageRepository.ts';
import type { DistRepository } from '../../repository/DistRepository.ts';
import { getScopeAndName } from '../../common/PackageUtil.ts';
import type { CacheService } from './CacheService.ts';
import { BUG_VERSIONS, LATEST_TAG } from '../../common/constants.ts';
import type { BugVersionStore } from '../../common/adapter/BugVersionStore.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BugVersionService {
  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly distRepository: DistRepository;

  @Inject()
  private readonly logger: Logger;

  @Inject()
  private readonly cacheService: CacheService;

  @Inject()
  private readonly bugVersionStore: BugVersionStore;

  async getBugVersion(): Promise<BugVersion | undefined> {
    // TODO performance problem, cache bugVersion and update with schedule
    const pkg = await this.packageRepository.findPackage('', BUG_VERSIONS);
    if (!pkg) return;
    /* c8 ignore next 10 */
    const tag = await this.packageRepository.findPackageTag(
      pkg.packageId,
      LATEST_TAG
    );
    if (!tag) return;
    let bugVersion = this.bugVersionStore.getBugVersion(tag.version);
    if (!bugVersion) {
      const packageVersionJson =
        (await this.distRepository.findPackageVersionManifest(
          pkg.packageId,
          tag.version
        )) as PackageJSONType;
      if (!packageVersionJson) return;
      const data = packageVersionJson.config?.['bug-versions'];
      bugVersion = new BugVersion(data || {});
      this.bugVersionStore.setBugVersion(bugVersion, tag.version);
    }
    return bugVersion;
  }

  async cleanBugVersionPackageCaches(bugVersion: BugVersion) {
    const fullnames = bugVersion.listAllPackagesHasBugs();
    await pMap(
      fullnames,
      async fullname => {
        await this.cacheService.removeCache(fullname);
      },
      {
        concurrency: 50,
        stopOnError: false,
      }
    );
  }

  /**
   * Fix package bug version with all versions
   * @param bugVersion - The bug version
   * @param fullname - The fullname of the package
   * @param manifests - The manifests of the package
   * @returns The versions of the fixed manifests
   */
  async fixPackageBugVersions(
    bugVersion: BugVersion,
    fullname: string,
    manifests: Record<string, PackageJSONType | AbbreviatedPackageJSONType | undefined>
  ) {
    const fixedVersions: string[] = [];
    // If package all version unpublished(like pinyin-tool), versions is undefined
    if (!manifests) {
      return fixedVersions;
    }
    for (const manifest of Object.values(manifests)) {
      const fixedVersion = this.fixPackageBugVersionWithAllVersions(
        fullname,
        bugVersion,
        manifest as PackageJSONType,
        manifests as Record<string, PackageJSONType>
      );
      if (fixedVersion) {
        fixedVersions.push(fixedVersion);
      }
    }
    return fixedVersions;
  }

  async fixPackageBugVersion(
    bugVersion: BugVersion,
    fullname: string,
    manifest: PackageJSONType
  ) {
    const advice = bugVersion.fixVersion(fullname, manifest.version);
    if (!advice) {
      return manifest;
    }
    const [scope, name] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      return manifest;
    }
    const packageVersion = await this.packageRepository.findPackageVersion(
      pkg.packageId,
      advice.version
    );
    if (!packageVersion) {
      return manifest;
    }
    const fixedManifest = await this.distRepository.findPackageVersionManifest(
      packageVersion.packageId,
      advice.version
    );
    if (!fixedManifest) {
      return manifest;
    }
    return bugVersion.fixManifest(manifest, fixedManifest);
  }

  /**
   * Fix package bug version with all versions
   * @param fullname - The fullname of the package
   * @param bugVersion - The bug version
   * @param manifest - The manifest of the package
   * @param manifests - The manifests of the package
   * @returns The version of the fixed manifest
   */
  private fixPackageBugVersionWithAllVersions(
    fullname: string,
    bugVersion: BugVersion,
    manifest: PackageJSONType,
    manifests: Record<string, PackageJSONType>
  ) {
    const advice = bugVersion.fixVersion(fullname, manifest.version);
    if (!advice) {
      return;
    }
    const fixedManifest = manifests[advice.version];
    if (!fixedManifest) {
      this.logger.warn(
        '[BugVersionService] not found pkg for %s@%s manifest',
        fullname,
        advice.version
      );
      return;
    }
    const newManifest = bugVersion.fixManifest(manifest, fixedManifest);
    manifests[manifest.version] = newManifest;

    return manifest.version;
  }
}
