import { mkdir } from 'fs/promises';
import path from 'path';
import { app } from 'egg-mock/bootstrap';
import dayjs from '../../app/common/dayjs';

const CleanTempDirPath = require.resolve('../../app/port/schedule/CleanTempDir');

describe('test/schedule/CleanTempDir.test.ts', () => {
  it('should clean dir success', async () => {
    const downloadDir = path.join(app.config.dataDir, 'downloads');
    const oldDirs = [
      path.join(downloadDir, dayjs().subtract(2, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(4, 'day').format('YYYY/MM/DD')),
      path.join(downloadDir, dayjs().subtract(2, 'month').format('YYYY/MM')),
      path.join(downloadDir, dayjs().subtract(1, 'year').format('YYYY')),
    ];
    for (const dir of oldDirs) {
      await mkdir(dir, { recursive: true });
    }
    app.mockLog();
    await app.runSchedule(CleanTempDirPath);
    app.expectLog('exists: true');
    app.expectLog('[CleanTempDir.subscribe] remove dir "');
    // again should work
    await app.runSchedule(CleanTempDirPath);
  });
});
