import { Event, Inject } from '@eggjs/tegg';
import { EggLogger } from 'egg';
import { PACKAGE_VERSION_ADDED } from './index';
import { BUG_VERSIONS } from '../../common/constants';
import { PackageManagerService } from '../service/PackageManagerService';
import { BugVersionService } from '../service/BugVersionService';

@Event(PACKAGE_VERSION_ADDED)
export class BugVersionFixHandler {
  @Inject()
  private readonly bugVersionService: BugVersionService;
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  @Inject()
  private readonly logger: EggLogger;

  async handle(fullname: string) {
    if (fullname !== BUG_VERSIONS) return;
    try {
      const bugVersion = await this.packageManagerService.getBugVersion();
      if (!bugVersion) return;
      await this.bugVersionService.cleanBugVersionPackageCaches(bugVersion);
    } catch (e) {
      e.message = '[BugVersionFixHandler] clean cache failed: ' + e.message;
      this.logger.error(e);
    }
  }
}
