import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { PackageManagerService } from '../../core/service/PackageManagerService';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60000,
  },
})
export class SavePackageVersionDownloadCounter {
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  async subscribe() {
    await this.packageManagerService.savePackageVersionCounters();
  }
}
