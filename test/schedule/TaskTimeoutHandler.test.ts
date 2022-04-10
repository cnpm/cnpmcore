import { app } from 'egg-mock/bootstrap';

describe('test/schedule/TaskTimeoutHandler.test.ts', () => {
  it('should work', async () => {
    app.mockLog();
    await app.runSchedule('TaskTimeoutHandler');
    app.expectLog('[TaskTimeoutHandler:subscribe] retry execute timeout tasks: {"processing":0,"waiting":0}');
    // again should work
    await app.runSchedule('TaskTimeoutHandler');
  });
});
