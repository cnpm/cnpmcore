import { mkdir } from 'fs/promises';
import path from 'path';
import { app } from 'egg-mock/bootstrap';
import dayjs from '../../app/common/dayjs';

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
    Reflect.apply(Reflect.get(app, 'mockLog'), app, []);
    await app.runSchedule('CleanTempDir');
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ 'exists: true' ]);
    Reflect.apply(Reflect.get(app, 'expectLog'), app, [ '[CleanTempDir.subscribe] remove dir "' ]);
    // again should work
    await app.runSchedule('CleanTempDir');
  });
});
