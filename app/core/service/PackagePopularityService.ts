import { AccessLevel, Inject, SingletonProto } from 'egg';

import { AbstractService } from '../../common/AbstractService.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';

@SingletonProto({ accessLevel: AccessLevel.PUBLIC })
export class PackagePopularityService extends AbstractService {
  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;

  validateConfig() {
    const config = this.config.cnpmcore.syncRecheck;
    for (const value of [
      config.minWeeklyDownloads,
      config.maxPendingPackages,
      config.maxAttemptsPerHour,
      config.dispatchInterval,
      ...config.delays,
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('syncRecheck limits must be positive integers');
    }
    if (!config.delays.length || config.delays.some((delay, i) => i > 0 && delay <= config.delays[i - 1])) {
      throw new Error('syncRecheck.delays must be nonempty and strictly increasing');
    }
  }

  async includes(fullname: string) {
    const config = this.config.cnpmcore.syncRecheck;
    if (!config.enabled) return false;
    this.validateConfig();
    const downloads = await this.packageVersionDownloadRepository.getWeeklyDownloads(fullname);
    return downloads >= config.minWeeklyDownloads;
  }
}
