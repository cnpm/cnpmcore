import { SemVer, valid } from 'semver';

export class PaddingSemVer {
  private readonly semver: SemVer;
  // 跳过 semver 中的 buildInfo, buildInfo 不参与版本比较
  private _paddingVersion: string;
  readonly isPreRelease: boolean;

  constructor(semver: string | SemVer) {
    // ignore invalid version, e.g.: '1000000000000000000.0.0' on https://registry.npmjs.com/latentflip-test
    if (!valid(semver)) {
      this.isPreRelease = true;
      this._paddingVersion = PaddingSemVer.anyVersion();
      return;
    }
    this.semver = new SemVer(semver);
    if ((this.semver as any).includePrerelease) {
      this.isPreRelease = true;
    } else if (this.semver.prerelease && this.semver.prerelease.length) {
      this.isPreRelease = true;
    } else {
      this.isPreRelease = false;
    }
  }

  get paddingVersion(): string {
    if (!this._paddingVersion) {
      this._paddingVersion = PaddingSemVer.paddingVersion(this.semver.major)
        + PaddingSemVer.paddingVersion(this.semver.minor)
        + PaddingSemVer.paddingVersion(this.semver.patch);
    }
    return this._paddingVersion;
  }

  // 版本信息中为纯数字, JS 中支持的最大整型为 16 位
  // 因此填充成 16 位对齐，如果版本号超过 16 位，则抛出异常
  static paddingVersion(v: number) {
    const t = String(v);
    if (t.length <= 16) {
      const padding = new Array(16 - t.length).fill(0)
        .join('');
      return padding + t;
    }
    throw new Error(`v ${v} too long`);
  }

  static anyVersion() {
    return '000000000000000000000000000000000000000000000000';
  }
}
