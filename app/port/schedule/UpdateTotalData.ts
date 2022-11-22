import { EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { PackageRepository } from '../../repository/PackageRepository';
import { TaskRepository } from '../../repository/TaskRepository';
import { ChangeRepository } from '../../repository/ChangeRepository';
import { CacheService } from '../../core/service/CacheService';
import { TaskType } from '../../common/enum/Task';
import dayjs from '../../common/dayjs';


@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60000,
  },
}, {
  // immediate = false on unittest env
  immediate: process.env.NODE_ENV !== 'test',
})
export class UpdateTotalData {
  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly taskRepository: TaskRepository;

  @Inject()
  private readonly changeRepository: ChangeRepository;

  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;

  @Inject()
  private readonly cacheService: CacheService;

  async subscribe() {
    const changesStreamTask = await this.taskRepository.findTaskByTargetName('GLOBAL_WORKER', TaskType.ChangesStream);
    const packageTotal = await this.packageRepository.queryTotal();

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
    const rows = await this.packageVersionDownloadRepository.query('total', lastYearStartDay.toDate(), today.toDate());
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

    const lastChange = await this.changeRepository.getLastChange();
    const totalData = {
      ...packageTotal,
      download,
      changesStream: changesStreamTask && changesStreamTask.data || {},
      lastChangeId: lastChange && lastChange.id || 0,
      cacheTime: new Date().toISOString(),
    };
    await this.cacheService.saveTotalData(totalData);
    this.logger.info('[UpdateTotalData.subscribe] total data: %j', totalData);
  }
}
