export interface BugVersionAdvice {
  version: string;
  reason: string;
}
export type BugVersionPackage = Record<string, BugVersionAdvice>;
export type BugVersionPackages = Record<string, BugVersionPackage>;

export class BugVersion {
  private readonly data: BugVersionPackages;

  constructor(data: BugVersionPackages) {
    this.data = data;
  }

  listAllPackagesHasBugs(): Array<string> {
    return Object.keys(this.data);
  }

  listBugVersions(pkgName: string): Array<string> {
    const bugVersionPackage = this.data[pkgName];
    if (!bugVersionPackage) {
      return [];
    }
    return Object.keys(bugVersionPackage);
  }

  fixVersion(pkgName: string, version: string): BugVersionAdvice | undefined {
    const advice = this.data[pkgName] && this.data[pkgName][version];
    if (advice && advice.version === version) return undefined;
    return advice;
  }

  // TODO manifest typing
  fixManifest(bugVersionManifest: any, fixVersionManifest: any): any {
    // If the tarball is same, manifest has fixed.
    if (bugVersionManifest.dist.tarball === fixVersionManifest.dist.tarball) {
      return;
    }
    const advice = this.fixVersion(bugVersionManifest.name, bugVersionManifest.version);
    if (!advice) {
      return;
    }
    const newManifest = JSON.parse(JSON.stringify(fixVersionManifest));
    const hotfixDeprecated = `[WARNING] Use ${advice.version} instead of ${bugVersionManifest.version}, reason: ${advice.reason}`;
    newManifest.deprecated = bugVersionManifest.deprecated ? `${bugVersionManifest.deprecated} (${hotfixDeprecated})` : hotfixDeprecated;
    // don't change version
    newManifest.version = bugVersionManifest.version;
    return newManifest;
  }
}
