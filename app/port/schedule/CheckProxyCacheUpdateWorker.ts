import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { SyncMode } from '../../common/constants';
// import { DIST_NAMES } from '../../core/entity/Package';
import { ProxyCacheService } from '../../core/service/ProxyCacheService';

@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 60000,
  },
})
export class CheckProxyCacheUpdateWorker {

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private proxyCacheService: ProxyCacheService;

  @Inject()
  private readonly proxyCacheRepository:ProxyCacheRepository;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) return;
    let pageIndex = 0;
    let { data: list } = await this.proxyCacheRepository.listCachedFiles({ pageSize: 5, pageIndex });
    while (list.length !== 0) {
      for (const item of list) {
        try {
          const task = await this.proxyCacheService.createTask(item.targetName, {
            version: item.version,
            fileType: item.fileType,
            filePath: item.filePath,
          });
          this.logger.info('[CheckProxyCacheUpdateWorker.subscribe:createTask][%s] taskId: %s, targetName: %s',
            pageIndex, task.taskId, task.targetName);
        } catch (err) {
          this.logger.error(err);
        }
      }
      pageIndex++;
      ({ data: list } = await this.proxyCacheRepository.listCachedFiles({ pageSize: 5, pageIndex }));
    }

  }
}
