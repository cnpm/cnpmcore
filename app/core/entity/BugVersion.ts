import type { PackageJSONType, AbbreviatedPackageJSONType } from "../../repository/PackageRepository.ts";

export interface BugVersionAdvice {
  /**
   * fixed version
   */
  version: string;
  /**
   * reason for fixed
   */
  reason: string;
}
export type BugVersionPackage = Record<string, BugVersionAdvice>;
// https://github.com/cnpm/bug-versions/blob/master/package.json#L136
// Example:
// {
//   "testmodule-show-package": {
//     "2.0.0": {
//       "version": "1.0.0",
//       "reason": "mock reason"
//     }
//   }
// }
export type BugVersionPackages = Record<string, BugVersionPackage>;

export type MixedBugVersionPackageType = PackageJSONType | AbbreviatedPackageJSONType;

export class BugVersion {
  private readonly data: BugVersionPackages;

  constructor(data: BugVersionPackages) {
    this.data = data;
  }

  /**
   * List all package names that have bugs
   */
  listAllPackagesHasBugs(): string[] {
    return Object.keys(this.data);
  }

  listBugVersions(pkgName: string): string[] {
    const bugVersionPackage = this.data[pkgName];
    if (!bugVersionPackage) {
      return [];
    }
    return Object.keys(bugVersionPackage);
  }

  hasBugVersions(pkgName: string): boolean {
    return pkgName in this.data;
  }

  /**
   * get fix version advice for a package version
   */
  fixVersion(pkgName: string, version: string): BugVersionAdvice | undefined {
    const advice = this.data[pkgName] && this.data[pkgName][version];
    if (!advice || advice.version === version) return undefined;
    return advice;
  }

  fixManifest(bugVersionManifest: MixedBugVersionPackageType, fixVersionManifest: MixedBugVersionPackageType): MixedBugVersionPackageType | undefined {
    // If the tarball is same, manifest has fixed.
    if (bugVersionManifest.dist?.tarball === fixVersionManifest.dist?.tarball) {
      return;
    }
    const advice = this.fixVersion(bugVersionManifest.name, bugVersionManifest.version);
    if (!advice) {
      return;
    }
    const newManifest = structuredClone(fixVersionManifest);
    const hotfixDeprecated = `[WARNING] Use ${advice.version} instead of ${bugVersionManifest.version}, reason: ${advice.reason}`;
    newManifest.deprecated = bugVersionManifest.deprecated
      ? `${bugVersionManifest.deprecated} (${hotfixDeprecated})`
      : hotfixDeprecated;
    // don't change version
    newManifest.version = bugVersionManifest.version;
    return newManifest;
  }
}
