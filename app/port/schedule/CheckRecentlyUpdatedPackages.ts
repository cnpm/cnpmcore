import { EggAppConfig, EggHttpClient, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { PackageSyncerService } from '../../core/service/PackageSyncerService';

// https://github.com/cnpm/cnpmcore/issues/9
@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    // every 5 mins
    interval: 60000 * 5,
  },
})
export class CheckRecentlyUpdatedPackages {
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly httpclient: EggHttpClient;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== 'all' || !this.config.cnpmcore.enableCheckRecentlyUpdated) return;
    const pageSize = 36;
    const pageCount = this.config.env === 'unittest' ? 2 : 5;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const offset = pageSize * pageIndex;
      const pageUrl = `https://www.npmjs.com/browse/updated?offset=${offset}`;
      let html = '';
      try {
        const { status, data } = await this.httpclient.request(pageUrl, {
          followRedirect: true,
          timeout: 10000,
        });
        this.logger.info('[CheckRecentlyUpdatedPackages.subscribe][%s] request %s status: %s, data size: %s',
          pageIndex, pageUrl, status, data.length);
        if (status === 200) {
          html = data.toString();
        }
      } catch (err) {
        this.logger.info('[CheckRecentlyUpdatedPackages.subscribe:error][%s] request %s error: %s',
          pageIndex, pageUrl, err);
        this.logger.error(err);
        continue;
      }

      const matchs = /window\.__context__ = ([^<]+?)<\/script>/.exec(html);
      if (!matchs) continue;

      try {
        const data = JSON.parse(matchs[1]);
        const packages = data.context.packages || [];
        if (Array.isArray(packages)) {
          this.logger.info('[CheckRecentlyUpdatedPackages.subscribe][%s] parse %d packages on %s',
            pageIndex, packages.length, pageUrl);
          for (const pkg of packages) {
            const task = await this.packageSyncerService.createTask(pkg.name, {
              tips: `Sync cause by recently updated packages ${pageUrl}`,
            });
            this.logger.info('[CheckRecentlyUpdatedPackages.subscribe:createTask][%s] taskId: %s, targetName: %s',
              pageIndex, task.taskId, task.targetName);
          }
        }
      } catch (err) {
        this.logger.info('[CheckRecentlyUpdatedPackages.subscribe:error][%s] parse %s context json error: %s',
          pageIndex, pageUrl, err);
        this.logger.error(err);
      }
    }
  }
}
