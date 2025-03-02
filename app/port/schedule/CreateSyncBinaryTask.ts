import { EggAppConfig } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';

import { BinarySyncerService } from '../../core/service/BinarySyncerService.js';
import binaries, { BinaryName } from '../../../config/binaries.js';

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

    for (const [ binaryName, binary ] of Object.entries(binaries)) {
      if (this.config.env === 'unittest' && binaryName !== 'node') continue;
      if (binary.disable) continue;

      // 默认只同步 binaryName 的二进制，即使有不一致的 category，会在同名的 binaryName 任务中同步
      // 例如 canvas 只同步 binaryName 为 canvas 的二进制，不同步 category 为 node-canvas-prebuilt 的二进制
      // node-canvas-prebuilt 的二进制会在 node-canvas-prebuilt 的任务中同步
      await this.binarySyncerService.createTask(binaryName as BinaryName);
    }
  }
}
