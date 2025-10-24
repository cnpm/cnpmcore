import {
  Schedule,
  ScheduleType,
  type IntervalParams,
} from 'egg/schedule';
import { Inject, Logger } from 'egg';

import type { ChangesStreamTaskData } from '../../core/entity/Task.ts';
import type { RegistryManagerService } from '../../core/service/RegistryManagerService.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';
import type { PackageRepository } from '../../repository/PackageRepository.ts';
import type { TaskRepository } from '../../repository/TaskRepository.ts';
import type { ChangeRepository } from '../../repository/ChangeRepository.ts';
import type {
  CacheService,
  DownloadInfo,
  TotalData,
} from '../../core/service/CacheService.ts';
import { TaskType } from '../../common/enum/Task.ts';
import { GLOBAL_WORKER } from '../../common/constants.ts';
import dayjs from '../../common/dayjs.ts';

@Schedule<IntervalParams>(
  {
    type: ScheduleType.WORKER,
    scheduleData: {
      interval: 60_000,
    },
  },
  {
    // immediate = false on unittest env
    immediate: process.env.NODE_ENV !== 'test',
  }
)
export class UpdateTotalData {
  @Inject()
  private readonly logger: Logger;

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

  @Inject()
  private readonly registryManagerService: RegistryManagerService;

  // 计算下载量相关信息，不区分不同 changesStream
  private async calculateDownloadInfo() {
    const download: DownloadInfo = {
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
    const rows = await this.packageVersionDownloadRepository.query(
      'total',
      lastYearStartDay.toDate(),
      today.toDate()
    );
    if (rows.length > 0) {
      const todayInt = Number(today.format('YYYYMMDD'));
      const yesterdayInt = Number(today.subtract(1, 'day').format('YYYYMMDD'));
      const samedayLastweekInt = Number(
        today.subtract(1, 'week').startOf('week').format('YYYYMMDD')
      );
      const thisWeekStartDayInt = Number(
        today.startOf('week').format('YYYYMMDD')
      );
      const thisWeekEndDayInt = Number(today.endOf('week').format('YYYYMMDD'));
      const thisMonthStartDayInt = Number(
        today.startOf('month').format('YYYYMMDD')
      );
      const thisMonthEndDayInt = Number(
        today.endOf('month').format('YYYYMMDD')
      );
      const thisYearStartDayInt = Number(
        today.startOf('year').format('YYYYMMDD')
      );
      const thisYearEndDayInt = Number(today.endOf('year').format('YYYYMMDD'));
      const lastWeekStartDayInt = Number(
        today.subtract(1, 'week').startOf('week').format('YYYYMMDD')
      );
      const lastWeekEndDayInt = Number(
        today.subtract(1, 'week').endOf('week').format('YYYYMMDD')
      );
      const lastMonthStartDayInt = Number(
        today.subtract(1, 'month').startOf('month').format('YYYYMMDD')
      );
      const lastMonthEndDayInt = Number(
        today.subtract(1, 'month').endOf('month').format('YYYYMMDD')
      );
      const lastYearStartDayInt = Number(
        today.subtract(1, 'year').startOf('year').format('YYYYMMDD')
      );
      const lastYearEndDayInt = Number(
        today.subtract(1, 'year').endOf('year').format('YYYYMMDD')
      );

      for (const row of rows) {
        for (let i = 1; i <= 31; i++) {
          const day = String(i).padStart(2, '0');
          const field = `d${day}` as keyof typeof row;
          const counter = row[field] as number;
          if (!counter) continue;
          const dayInt = row.yearMonth * 100 + i;
          if (dayInt === todayInt) download.today += counter;
          if (dayInt === yesterdayInt) download.yesterday += counter;
          if (dayInt === samedayLastweekInt)
            download.samedayLastweek += counter;
          if (dayInt >= thisWeekStartDayInt && dayInt <= thisWeekEndDayInt)
            download.thisweek += counter;
          if (dayInt >= thisMonthStartDayInt && dayInt <= thisMonthEndDayInt)
            download.thismonth += counter;
          if (dayInt >= thisYearStartDayInt && dayInt <= thisYearEndDayInt)
            download.thisyear += counter;
          if (dayInt >= lastWeekStartDayInt && dayInt <= lastWeekEndDayInt)
            download.lastweek += counter;
          if (dayInt >= lastMonthStartDayInt && dayInt <= lastMonthEndDayInt)
            download.lastmonth += counter;
          if (dayInt >= lastYearStartDayInt && dayInt <= lastYearEndDayInt)
            download.lastyear += counter;
        }
      }
    }
    return download;
  }

  async subscribe() {
    const packageTotal = await this.packageRepository.queryTotal();
    const download = await this.calculateDownloadInfo();

    const lastChange = await this.changeRepository.getLastChange();
    const totalData: TotalData = {
      ...packageTotal,
      packageCount: Number(packageTotal.packageCount),
      packageVersionCount: Number(packageTotal.packageVersionCount),
      download,
      lastChangeId: (lastChange && lastChange.id) || 0,
      cacheTime: new Date().toISOString(),
      changesStream: {} as unknown as ChangesStreamTaskData,
      upstreamRegistries: [],
    };

    const tasks = await this.taskRepository.findTasksByCondition({
      type: TaskType.ChangesStream,
    });
    for (const task of tasks) {
      // 全局 changesStream
      const data = task.data as ChangesStreamTaskData;
      // 补充录入 upstreamRegistries
      const registry = await this.registryManagerService.findByRegistryId(
        data.registryId as string
      );
      if (registry) {
        totalData.upstreamRegistries.push({
          ...data,
          source_registry: registry?.host,
          changes_stream_url: registry?.changeStream,
          registry_name: registry?.name,
        });
      }

      // 兼容 LegacyInfo 字段
      if (task.targetName === GLOBAL_WORKER) {
        totalData.changesStream = data;
      }
    }

    await this.cacheService.saveTotalData(totalData);
    this.logger.info('[UpdateTotalData.subscribe] total data: %j', totalData);
  }
}
