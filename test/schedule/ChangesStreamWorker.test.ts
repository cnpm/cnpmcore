import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ChangesStreamService } from 'app/core/service/ChangesStreamService';
import { TaskService } from 'app/core/service/TaskService';
import { Task } from 'app/repository/model/Task';

describe('test/schedule/ChangesStreamWorker.test.ts', () => {
  let ctx: Context;
  let changesStreamService: ChangesStreamService;
  let taskService: TaskService;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    changesStreamService = await ctx.getEggObject(ChangesStreamService);
    taskService = await ctx.getEggObject(TaskService);
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should work', async () => {
    app.mockLog();
    // syncMode=none
    await app.runSchedule('ChangesStreamWorker');
    app.notExpectLog('[ChangesStreamWorker:start]');

    // syncMode=all
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://r.cnpmjs.org');
    await app.runSchedule('ChangesStreamWorker');
    app.notExpectLog('[ChangesStreamWorker:start]');

    // syncMode=all and enableChangesStream = true
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await app.runSchedule('ChangesStreamWorker');
    app.expectLog('[ChangesStreamWorker:start]');
    app.expectLog('[ChangesStreamService.executeTask:changes] since: ');
    const task = await changesStreamService.findExecuteTask();
    assert(!task, 'task should not exists');

    // mock no changed after 10 mins
    const existsTask = await Task.findOne({ type: 'changes_stream' });
    assert(existsTask);
    existsTask.updatedAt = new Date(existsTask.updatedAt.getTime() - 60000 * 10 - 1);
    await existsTask.save();
    const result = await taskService.retryExecuteTimeoutTasks();
    assert(result.processing === 1);
    assert(result.waiting === 0);
    // mock request https://replicate.npmjs.com/_changes error
    app.mockHttpclient(/https:\/\/replicate.npmjs.com\/_changes/, () => {
      throw new Error('mock request replicate _changes error');
    });
    app.mockHttpclient(/https:\/\/r.cnpmjs.org\/_changes/, () => {
      throw new Error('mock request replicate _changes error');
    });
    await app.runSchedule('ChangesStreamWorker');
    app.expectLog('[ChangesStreamService.executeTask:error]');
    app.expectLog('mock request replicate _changes error');
  });

  it('should work on replicate: r.cnpmjs.org', async () => {
    app.mockLog();
    // syncMode=none
    await app.runSchedule('ChangesStreamWorker');
    app.notExpectLog('[ChangesStreamWorker:start]');

    // syncMode=all
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://r.cnpmjs.org');
    mock(app.config.cnpmcore, 'changesStreamRegistryMode', 'json');
    await app.runSchedule('ChangesStreamWorker');
    app.notExpectLog('[ChangesStreamWorker:start]');

    // syncMode=all and enableChangesStream = true
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    await app.runSchedule('ChangesStreamWorker');
    app.expectLog('[ChangesStreamWorker:start]');
    app.expectLog('[ChangesStreamService.executeTask:changes] since:');
    app.expectLog(/, \d{2} new tasks,/);
    const task = await changesStreamService.findExecuteTask();
    assert(!task);

    // mock no changed after 10 mins
    const existsTask = await Task.findOne({ type: 'changes_stream' });
    assert(existsTask);
    existsTask.updatedAt = new Date(existsTask.updatedAt.getTime() - 60000 * 10 - 1);
    await existsTask.save();
    const result = await taskService.retryExecuteTimeoutTasks();
    assert(result.processing === 1);
    assert(result.waiting === 0);
    // mock request https://r.cnpmjs.org/_changes error
    app.mockHttpclient(/https:\/\/r\.cnpmjs\.org\/_changes/, () => {
      throw new Error('mock request replicate r.cnpmjs.org/_changes error');
    });
    await app.runSchedule('ChangesStreamWorker');
    app.expectLog('[ChangesStreamService.executeTask:error]');
    app.expectLog('mock request replicate r.cnpmjs.org/_changes error');
  });

  it('should mock get update_seq error', async () => {
    app.mockLog();
    mock(app.config.cnpmcore, 'syncMode', 'all');
    mock(app.config.cnpmcore, 'enableChangesStream', true);
    mock(app.config.cnpmcore, 'changesStreamRegistry', 'https://r.cnpmjs.org');
    app.mockHttpclient(/https:\/\/replicate\.npmjs\.com\//, () => {
      throw new Error('mock request replicate.npmjs.com error');
    });
    app.mockHttpclient(/https:\/\/r\.cnpmjs\.org\//, () => {
      throw new Error('mock request replicate.npmjs.com error');
    });
    await app.runSchedule('ChangesStreamWorker');
    app.expectLog('[ChangesStreamWorker:start]');
    app.expectLog('[ChangesStreamService.executeTask:error]');
    app.expectLog('mock request replicate.npmjs.com error');
  });
});
