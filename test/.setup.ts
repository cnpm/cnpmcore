import { mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from './TestUtil.js';

beforeEach(async () => {
  // don't show console log on unittest by default
  TestUtil.app.loggers.disableConsole();
  await TestUtil.app.redis.flushdb('sync');
});

afterEach(async () => {
  await TestUtil.truncateDatabase();
  await mock.restore();
});
