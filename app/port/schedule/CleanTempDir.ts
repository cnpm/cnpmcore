import { EggAppConfig, EggLogger } from 'egg';
import { CronParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { rm, access } from 'node:fs/promises';
import path from 'node:path';
import dayjs from '../../common/dayjs';

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
  private readonly logger: EggLogger;

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
      } catch (err) {
        // console.log(err);
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
