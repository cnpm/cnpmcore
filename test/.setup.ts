import { mock } from 'egg-mock/bootstrap';
import { TestUtil } from './TestUtil';

before(() => {
  // dont show console log on unittest by default
  // app.loggers.disableConsole();
});

afterEach(async () => {
  mock.restore();
  await TestUtil.truncateDatabase();
});
