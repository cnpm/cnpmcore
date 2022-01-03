import { Subscription } from 'egg';
import { rm, access } from 'fs/promises';
import path from 'path';
import dayjs from '../common/dayjs';

export default class CleanTempDir extends Subscription {
  static get schedule() {
    return {
      cron: '0 2 * * *', // run every day at 02:00
      type: 'worker',
    };
  }

  async subscribe() {
    const { ctx, app } = this;
    const downloadDir = path.join(app.config.dataDir, 'downloads');
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
      ctx.logger.info('[CleanTempDir.subscribe] dir "%s" exists: %s', dir, exists);
      if (exists) {
        await rm(dir, { recursive: true, force: true });
        ctx.logger.info('[CleanTempDir.subscribe] remove dir "%s"', dir);
      }
    }
  }
}
