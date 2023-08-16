import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import semver, { Range } from 'semver';
import { Result, AliasResult } from 'npm-package-arg';
import { PackageVersionRepository } from '../../repository/PackageVersionRepository';
import { getScopeAndName } from '../../common/PackageUtil';
import { SqlRange } from '../entity/SqlRange';
import { BugVersionService } from './BugVersionService';
import type { PackageJSONType } from '../../repository/PackageRepository';
import { DistRepository } from '../../repository/DistRepository';
import { BugVersionAdvice } from '../entity/BugVersion';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionService {
  @Inject()
  private packageVersionRepository: PackageVersionRepository;

  @Inject()
  private readonly bugVersionService: BugVersionService;

  @Inject()
  private readonly distRepository: DistRepository;

  async readManifest(pkgId: string, spec: Result, isFullManifests: boolean, withBugVersion = true): Promise<PackageJSONType | undefined> {
    const realSpec = this.findRealSpec(spec);
    let version = await this.getVersion(realSpec, false);
    if (!version) {
      return undefined;
    }
    let bugVersionAdvice: {
      advice: BugVersionAdvice,
      version: string,
    } | undefined;
    if (withBugVersion) {
      const bugVersion = await this.bugVersionService.getBugVersion();
      if (bugVersion) {
        const advice = bugVersion.fixVersion(spec.name!, version);
        if (advice) {
          bugVersionAdvice = {
            advice,
            version,
          };
          version = advice.version;
        }
      }
    }
    let manifest;
    if (isFullManifests) {
      manifest = await this.distRepository.findPackageVersionManifest(pkgId, version);
    } else {
      manifest = await this.distRepository.findPackageAbbreviatedManifest(pkgId, version);
    }
    if (manifest && bugVersionAdvice) {
      manifest.deprecated = `[WARNING] Use ${bugVersionAdvice.advice.version} instead of ${bugVersionAdvice.version}, reason: ${bugVersionAdvice.advice.reason}`;
      manifest.version = bugVersionAdvice.version;
    }
    return manifest;
  }

  private findRealSpec(spec: Result) {
    let realSpec: Result;
    switch (spec.type) {
      case 'alias':
        realSpec = (spec as AliasResult).subSpec;
        break;
      case 'version':
      case 'tag':
      case 'range':
        realSpec = spec;
        break;
      default:
        throw new Error(`npmcore not support spec: ${spec.raw}`);
    }
    return realSpec;
  }

  async getVersion(spec: Result, withBugVersion = true): Promise<string | undefined | null> {
    let version: string | undefined | null;
    const [ scope, name ] = getScopeAndName(spec.name!);
    // 优先通过 tag 来进行判断
    if (spec.type === 'tag') {
      version = await this.packageVersionRepository.findVersionByTag(scope, name, spec.fetchSpec!);
    } else if (spec.type === 'version') {
      // 1.0.0
      // '=1.0.0' => '1.0.0'
      // https://github.com/npm/npm-package-arg/blob/main/lib/npa.js#L392
      version = semver.valid(spec.fetchSpec!, true);
    } else if (spec.type === 'range') {
      // a@1.1 情况下，1.1 会解析为 range，如果有对应的 distTag 时会失效
      // 这里需要进行兼容
      // 仅当 spec 不为 version 时才查询，减少请求次数
      const versionMatchTag = await this.packageVersionRepository.findVersionByTag(scope, name, spec.fetchSpec!);
      if (versionMatchTag) {
        version = versionMatchTag;
      } else {
        const range = new Range(spec.fetchSpec!);
        const paddingSemVer = new SqlRange(range);
        if (paddingSemVer.containPreRelease) {
          const versions = await this.packageVersionRepository.findSatisfyVersionsWithPrerelease(scope, name, paddingSemVer);
          version = semver.maxSatisfying(versions, range);
        } else {
          version = await this.packageVersionRepository.findMaxSatisfyVersion(scope, name, paddingSemVer);
        }
      }
    }
    if (version && withBugVersion) {
      const bugVersion = await this.bugVersionService.getBugVersion();
      if (bugVersion) {
        const advice = bugVersion.fixVersion(spec.name!, version);
        if (advice) {
          version = advice.version;
        }
      }
    }
    return version;
  }
}
