import { Event, Inject } from '@eggjs/tegg';
import type { EggLogger } from 'egg';
import { PACKAGE_VERSION_ADDED } from './index.js';
import { BUG_VERSIONS } from '../../common/constants.js';
import type { BugVersionService } from '../service/BugVersionService.js';

@Event(PACKAGE_VERSION_ADDED)
export class BugVersionFixHandler {
  @Inject()
  private readonly bugVersionService: BugVersionService;

  @Inject()
  private readonly logger: EggLogger;

  async handle(fullname: string) {
    if (fullname !== BUG_VERSIONS) return;
    try {
      const bugVersion = await this.bugVersionService.getBugVersion();
      if (!bugVersion) return;
      await this.bugVersionService.cleanBugVersionPackageCaches(bugVersion);
    } catch (e) {
      e.message = `[BugVersionFixHandler] clean cache failed: ${e.message}`;
      this.logger.error(e);
    }
  }
}
