import { AccessLevel, SingletonProto } from '@eggjs/tegg';
import { BugVersion } from '../../core/entity/BugVersion';

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
