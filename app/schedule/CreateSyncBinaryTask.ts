import { Subscription } from 'egg';
import { BinarySyncerService } from '../core/service/BinarySyncerService';
import binaries from '../../config/binaries';

const cnpmcoreCore = 'cnpmcoreCore';

export default class CreateSyncBinaryTask extends Subscription {
  static get schedule() {
    return {
      // every 5 mins
      interval: 60000 * 5,
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (!app.config.cnpmcore.enableSyncBinary) return;

    await ctx.beginModuleScope(async () => {
      const binarySyncerService: BinarySyncerService = ctx.module[cnpmcoreCore].binarySyncerService;
      for (const binary of Object.values(binaries)) {
        if (app.config.env === 'unittest' && binary.category !== 'node') continue;
        await binarySyncerService.createTask(binary.category);
      }
    });
  }
}
