import { Subscription } from 'egg';
import { PackageVersionDownloadRepository } from '../repository/PackageVersionDownloadRepository';
import { PackageRepository } from '../repository/PackageRepository';
import { TaskRepository } from '../repository/TaskRepository';
import { ChangeRepository } from '../repository/ChangeRepository';
import { CacheService } from '../core/service/CacheService';
import { TaskType } from '../common/enum/Task';
import dayjs from '../common/dayjs';

const cnpmcoreRepository = 'cnpmcoreRepository';
const cnpmcoreCore = 'cnpmcoreCore';

export default class UpdateTotalData extends Subscription {
  static get schedule() {
    return {
      // immediate = false on unittest env
      immediate: process.env.NODE_ENV !== 'test',
      interval: 60000,
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx } = this;
    await ctx.beginModuleScope(async () => {
      const packageVersionDownloadRepository: PackageVersionDownloadRepository =
        ctx.module[cnpmcoreRepository].packageVersionDownloadRepository;
      const packageRepository: PackageRepository = ctx.module[cnpmcoreRepository].packageRepository;
      const taskRepository: TaskRepository = ctx.module[cnpmcoreRepository].taskRepository;
      const changeRepository: ChangeRepository = ctx.module[cnpmcoreRepository].changeRepository;
      const cacheService: CacheService = ctx.module[cnpmcoreCore].cacheService;

      const changesStreamTask = await taskRepository.findTaskByTargetName('GLOBAL_WORKER', TaskType.ChangesStream);
      const packageTotal = await packageRepository.queryTotal();

      const download = {
        today: 0,
        yesterday: 0,
        samedayLastweek: 0,
        thisweek: 0,
        thismonth: 0,
        thisyear: 0,
        lastweek: 0,
        lastmonth: 0,
        lastyear: 0,
      };
      const today = dayjs();
      const lastYearStartDay = today.subtract(1, 'year').startOf('year');
      const rows = await packageVersionDownloadRepository.query('total', lastYearStartDay.toDate(), today.toDate());
      if (rows.length > 0) {
        const todayInt = Number(today.format('YYYYMMDD'));
        const yesterdayInt = Number(today.subtract(1, 'day').format('YYYYMMDD'));
        const samedayLastweekInt = Number(today.subtract(1, 'week').startOf('week').format('YYYYMMDD'));
        const thisWeekStartDayInt = Number(today.startOf('week').format('YYYYMMDD'));
        const thisWeekEndDayInt = Number(today.endOf('week').format('YYYYMMDD'));
        const thisMonthStartDayInt = Number(today.startOf('month').format('YYYYMMDD'));
        const thisMonthEndDayInt = Number(today.endOf('month').format('YYYYMMDD'));
        const thisYearStartDayInt = Number(today.startOf('year').format('YYYYMMDD'));
        const thisYearEndDayInt = Number(today.endOf('year').format('YYYYMMDD'));
        const lastWeekStartDayInt = Number(today.subtract(1, 'week').startOf('week').format('YYYYMMDD'));
        const lastWeekEndDayInt = Number(today.subtract(1, 'week').endOf('week').format('YYYYMMDD'));
        const lastMonthStartDayInt = Number(today.subtract(1, 'month').startOf('month').format('YYYYMMDD'));
        const lastMonthEndDayInt = Number(today.subtract(1, 'month').endOf('month').format('YYYYMMDD'));
        const lastYearStartDayInt = Number(today.subtract(1, 'year').startOf('year').format('YYYYMMDD'));
        const lastYearEndDayInt = Number(today.subtract(1, 'year').endOf('year').format('YYYYMMDD'));

        for (const row of rows) {
          for (let i = 1; i <= 31; i++) {
            const day = String(i).padStart(2, '0');
            const field = `d${day}`;
            const counter = row[field];
            if (!counter) continue;
            const dayInt = row.yearMonth * 100 + i;
            if (dayInt === todayInt) download.today += counter;
            if (dayInt === yesterdayInt) download.yesterday += counter;
            if (dayInt === samedayLastweekInt) download.samedayLastweek += counter;
            if (dayInt >= thisWeekStartDayInt && dayInt <= thisWeekEndDayInt) download.thisweek += counter;
            if (dayInt >= thisMonthStartDayInt && dayInt <= thisMonthEndDayInt) download.thismonth += counter;
            if (dayInt >= thisYearStartDayInt && dayInt <= thisYearEndDayInt) download.thisyear += counter;
            if (dayInt >= lastWeekStartDayInt && dayInt <= lastWeekEndDayInt) download.lastweek += counter;
            if (dayInt >= lastMonthStartDayInt && dayInt <= lastMonthEndDayInt) download.lastmonth += counter;
            if (dayInt >= lastYearStartDayInt && dayInt <= lastYearEndDayInt) download.lastyear += counter;
          }
        }
      }

      const lastChange = await changeRepository.getLastChange();
      const totalData = {
        ...packageTotal,
        download,
        changesStream: changesStreamTask && changesStreamTask.data || {},
        lastChangeId: lastChange && lastChange.id || 0,
        cacheTime: new Date().toISOString(),
      };
      await cacheService.saveTotalData(totalData);
      ctx.logger.info('[UpdateTotalData.subscribe] total data: %j', totalData);
    });
  }
}
