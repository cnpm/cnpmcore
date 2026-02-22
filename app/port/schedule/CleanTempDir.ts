import { access, rm } from 'node:fs/promises';
import path from 'node:path';

import { Inject, Logger, EggAppConfig } from 'egg';
import { Schedule, ScheduleType, type CronParams } from 'egg/schedule';

import dayjs from '../../common/dayjs.ts';

@Schedule<CronParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    cron: '0 2 * * *', // run every day at 02:00
  },
})
export class CleanTempDir {
  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: Logger;

  async subscribe() {
    const downloadDir = path.join(this.config.dataDir, 'downloads');
    const oldDirs = [
      path.join(downloadDir, dayjs().subtract(1, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(2, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(3, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(4, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(1, 'month').format('YYYY/MM')),
      path.join(downloadDir, dayjs().subtract(2, 'month').format('YYYY/MM')),
      path.join(downloadDir, dayjs().subtract(1, 'year').format('YYYY')),
    ];
    for (const dir of oldDirs) {
      let exists = false;
      try {
        await access(dir);
        exists = true;
      } catch {
        exists = false;
      }
      this.logger.info('[CleanTempDir.subscribe] dir "%s" exists: %s', dir, exists);
      if (exists) {
        await rm(dir, { recursive: true, force: true });
        this.logger.info('[CleanTempDir.subscribe] remove dir "%s"', dir);
      }
    }
  }
}
