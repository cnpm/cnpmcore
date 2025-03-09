import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '@eggjs/mock/bootstrap';

import dayjs from '../../app/common/dayjs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CleanTempDirPath = path.join(__dirname, '../../app/port/schedule/CleanTempDir.ts');

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
