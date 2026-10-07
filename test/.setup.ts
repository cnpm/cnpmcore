import { beforeEach, afterEach } from 'vitest';
import { mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from './TestUtil.js';
import { PackageManagerService } from '../app/core/service/PackageManagerService.js';

beforeEach(async () => {
  // don't show console log on unittest by default
  TestUtil.app.loggers.disableConsole();
  TestUtil.app.mockLog();
  mock(PackageManagerService, 'downloadCounters', {});
  await TestUtil.app.redis.flushdb('sync');
});

afterEach(async () => {
  await TestUtil.truncateDatabase();
  await mock.restore();
});
