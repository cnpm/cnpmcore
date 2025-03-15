import {
  Schedule,
  ScheduleType,
  type IntervalParams,
} from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';

import type { PackageManagerService } from '../../core/service/PackageManagerService.js';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60_000,
  },
})
export class SavePackageVersionDownloadCounter {
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  async subscribe() {
    await this.packageManagerService.savePackageVersionCounters();
  }
}
