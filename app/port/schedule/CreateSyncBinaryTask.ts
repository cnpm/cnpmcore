import { EggAppConfig } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { BinarySyncerService } from '../../core/service/BinarySyncerService';
import binaries from '../../../config/binaries';

@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    // every 5 mins
    interval: 60000 * 5,
  },
})
export class CreateSyncBinaryTask {
  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly binarySyncerService: BinarySyncerService;

  async subscribe() {
    if (!this.config.cnpmcore.enableSyncBinary) return;

    for (const binary of Object.values(binaries)) {
      if (this.config.env === 'unittest' && binary.category !== 'node') continue;
      if (binary.disable) continue;
      await this.binarySyncerService.createTask(binary.category);
    }
  }
}
