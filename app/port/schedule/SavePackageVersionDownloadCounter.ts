import {
  Schedule,
  ScheduleType,
  type IntervalParams,
} from 'egg/schedule';
import { Inject } from 'egg';

import type { PackageManagerService } from '../../core/service/PackageManagerService.ts';

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
