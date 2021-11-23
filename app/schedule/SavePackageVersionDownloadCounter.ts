import { PackageManagerService } from '../core/service/PackageManagerService';
import { Subscription } from 'egg';

const cnpmcoreCore = 'cnpmcoreCore';

export default class SavePackageVersionDownloadCounter extends Subscription {
  static get schedule() {
    return {
      interval: 1000,
      type: 'all',
    };
  }

  async subscribe() {
    const { ctx } = this;
    await ctx.beginModuleScope(async () => {
      const packageManagerService = ctx.module[cnpmcoreCore].packageManagerService as PackageManagerService;
      await packageManagerService.savePackageVersionCounters();
    });
  }
}
