import { Subscription } from 'egg';
import { PackageSyncerService } from '../core/service/PackageSyncerService';

const cnpmcoreCore = 'cnpmcoreCore';

// https://github.com/cnpm/cnpmcore/issues/9
export default class CheckRecentlyUpdatedPackages extends Subscription {
  static get schedule() {
    return {
      // every 5 mins
      interval: 60000 * 5,
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    if (app.config.cnpmcore.syncMode !== 'all' || !app.config.cnpmcore.enableCheckRecentlyUpdated) return;

    await ctx.beginModuleScope(async () => {
      const packageSyncerService: PackageSyncerService = ctx.module[cnpmcoreCore].packageSyncerService;
      const pageSize = 36;
      const pageCount = app.config.env === 'unittest' ? 2 : 5;
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const offset = pageSize * pageIndex;
        const pageUrl = `https://www.npmjs.com/browse/updated?offset=${offset}`;
        let html = '';
        try {
          const { status, data } = await ctx.httpclient.request(pageUrl, {
            followRedirect: true,
            timeout: 10000,
          });
          ctx.logger.info('[CheckRecentlyUpdatedPackages.subscribe][%s] request %s status: %s, data size: %s',
            pageIndex, pageUrl, status, data.length);
          if (status === 200) {
            html = data.toString();
          }
        } catch (err) {
          ctx.logger.info('[CheckRecentlyUpdatedPackages.subscribe:error][%s] request %s error: %s',
            pageIndex, pageUrl, err);
          ctx.logger.error(err);
          continue;
        }

        const matchs = /window\.__context__ = ([^<]+?)<\/script>/.exec(html);
        if (!matchs) continue;

        try {
          const data = JSON.parse(matchs[1]);
          const packages = data.context.packages || [];
          if (Array.isArray(packages)) {
            ctx.logger.info('[CheckRecentlyUpdatedPackages.subscribe][%s] parse %d packages on %s',
              pageIndex, packages.length, pageUrl);
            for (const pkg of packages) {
              const task = await packageSyncerService.createTask(pkg.name, {
                tips: `Sync cause by recently updated packages ${pageUrl}`,
              });
              ctx.logger.info('[CheckRecentlyUpdatedPackages.subscribe:createTask][%s] taskId: %s, targetName: %s',
                pageIndex, task.taskId, task.targetName);
            }
          }
        } catch (err) {
          ctx.logger.info('[CheckRecentlyUpdatedPackages.subscribe:error][%s] parse %s context json error: %s',
            pageIndex, pageUrl, err);
          ctx.logger.error(err);
        }
      }
    });
  }
}
