import { mock } from 'egg-mock/bootstrap';
import { TestUtil } from './TestUtil';

afterEach(async () => {
  mock.restore();
  await TestUtil.truncateDatabase();
});
