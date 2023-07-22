import { EggAppConfig } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { ProxyModeCachedFilesRepository } from '../../repository/ProxyModeCachedFilesRepository';
import { SyncMode } from '../../common/constants';
// import { DIST_NAMES } from '../../core/entity/Package';
// import { ProxyModeService } from '../../core/service/ProxyModeService';

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 60000,
  },
})
export class SyncProxyModeCacheWorker {

  @Inject()
  private readonly config: EggAppConfig;

  // @Inject()
  // private proxyModeService: ProxyModeService;

  // @Inject()
  // private readonly logger: EggLogger;

  // @Inject()
  // private readonly httpclient: EggHttpClient;

  @Inject()
  private readonly proxyModeCachedFilesRepository:ProxyModeCachedFilesRepository;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) return;
    // const pageSize = 36;
    // const pageCount = this.config.env === 'unittest' ? 2 : 5;
    let pageIndex = 0;
    let { data: list } = await this.proxyModeCachedFilesRepository.listCachedFiles({ pageSize: 5, pageIndex });
    while (list.length !== 0) {
      // TODO
      const requestList = list.map(item => {
        console.log(item.targetName, item.version);
        return Promise.resolve('');
      });
      await Promise.allSettled(requestList);
      pageIndex++;
      ({ data: list } = await this.proxyModeCachedFilesRepository.listCachedFiles({ pageSize: 5, pageIndex }));
    }

  }
}
