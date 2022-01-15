import { mock } from 'egg-mock/bootstrap';
import { TestUtil } from './TestUtil';

before(async () => {
  // dont show console log on unittest by default
  TestUtil.app.loggers.disableConsole();
  await TestUtil.app.redis.flushall();
});

afterEach(async () => {
  mock.restore();
  await TestUtil.truncateDatabase();
});
