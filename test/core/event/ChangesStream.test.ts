import { PackageVersionAddedChangesStreamEvent } from '../../../app/core/event/ChangesStream';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/core/event/BugVersionFixHandler.test.ts', () => {
  let packageVersionAddedChangesStreamEvent: PackageVersionAddedChangesStreamEvent;

  before(async () => {
    packageVersionAddedChangesStreamEvent = await app.getEggObject(PackageVersionAddedChangesStreamEvent);
  });

  it('should trigger hook', async () => {
    app.mockLog();
    mock(app.config.cnpmcore, 'hookEnable', true);
    await packageVersionAddedChangesStreamEvent.handle('banana', '1.0.0');
    app.expectLog(/TaskService\.createTask:new/);
  });

  it('should ignore hook when disable', async () => {
    app.mockLog();
    mock(app.config.cnpmcore, 'hookEnable', false);
    await packageVersionAddedChangesStreamEvent.handle('banana', '1.0.0');
    app.notExpectLog(/TaskService\.createTask:new/);
  });
});
