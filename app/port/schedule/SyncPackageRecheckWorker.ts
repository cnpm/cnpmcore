import { Config, Inject } from 'egg';
import { Schedule, ScheduleType, type IntervalParams } from 'egg/schedule';

import { SyncMode } from '../../common/constants.ts';
import type { PackageSyncRecheckService } from '../../core/service/PackageSyncRecheckService.ts';

@Schedule<IntervalParams>({ type: ScheduleType.WORKER, scheduleData: { interval: 1000 } })
export class SyncPackageRecheckWorker {
  @Inject()
  private readonly config: Config;
  @Inject()
  private readonly packageSyncRecheckService: PackageSyncRecheckService;

  async subscribe() {
    if (!this.config.cnpmcore.enableChangesStream || this.config.cnpmcore.syncMode === SyncMode.none) return;
    await this.packageSyncRecheckService.dispatch();
  }
}
