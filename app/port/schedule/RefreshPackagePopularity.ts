import { Config, Inject } from 'egg';
import { Schedule, ScheduleType, type IntervalParams } from 'egg/schedule';

import { SyncMode } from '../../common/constants.ts';
import type { PackagePopularityService } from '../../core/service/PackagePopularityService.ts';

@Schedule<IntervalParams>({ type: ScheduleType.WORKER, scheduleData: { interval: 60_000 } })
export class RefreshPackagePopularity {
  @Inject()
  private readonly config: Config;
  @Inject()
  private readonly packagePopularityService: PackagePopularityService;

  async subscribe() {
    if (!this.config.cnpmcore.enableChangesStream || this.config.cnpmcore.syncMode === SyncMode.none) return;
    await this.packagePopularityService.refresh();
  }
}
