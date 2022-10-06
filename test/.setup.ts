import { mock } from 'egg-mock/bootstrap';
import { TestUtil } from './TestUtil';

beforeEach(async () => {
  // dont show console log on unittest by default
  TestUtil.app.loggers.disableConsole();
  await TestUtil.app.redis.flushdb('sync');
});

afterEach(async () => {
  await TestUtil.truncateDatabase();
  await mock.restore();
});
