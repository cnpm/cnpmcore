import { AccessLevel, SingletonProto } from 'egg';

import type { BugVersion } from '../../core/entity/BugVersion.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BugVersionStore {
  private bugVersion: BugVersion | undefined;
  private version: string | undefined;

  getBugVersion(version: string): BugVersion | undefined {
    if (this.version === version) {
      return this.bugVersion;
    }
  }

  setBugVersion(bugVersion: BugVersion, version: string) {
    this.version = version;
    this.bugVersion = bugVersion;
  }
}
