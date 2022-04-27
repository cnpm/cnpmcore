export interface BugVersionAdvice {
  version: string;
  reason: string;
  scripts?: Record<string, string>;
}
export type BugVersionPackage = Record<string, BugVersionAdvice>;
export type BugVersionPackages = Record<string, BugVersionPackage>;

export class BugVersion {
  private readonly data: BugVersionPackages;

  constructor(data) {
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
    if (advice && advice.version === version && Object.keys(advice.scripts || {}).length === 0) return undefined;
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
    let hotfixDeprecated;
    // don't change version
    newManifest.version = bugVersionManifest.version;
    hotfixDeprecated = `[WARNING] Use ${advice.version} instead of ${bugVersionManifest.version}, reason: ${advice.reason}`;

    // override scripts
    if (newManifest.scripts && Object.keys(newManifest.scripts).length > 0 && advice.scripts && Object.keys(advice.scripts).length > 0) {
      Object.assign(newManifest.scripts, advice.scripts);
      if (advice.version !== bugVersionManifest.version) hotfixDeprecated = `[WARNING] Override scripts [${Object.keys(advice.scripts).join(',')}], reason: ${advice.reason}`;
    }

    newManifest.deprecated = bugVersionManifest.deprecated ? `${bugVersionManifest.deprecated} (${hotfixDeprecated})` : hotfixDeprecated;
    return newManifest;
  }
}
