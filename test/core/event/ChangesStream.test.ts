import { PackageVersionAdded } from '../../../app/core/event/ChangesStream';
import { app, mock } from 'egg-mock/bootstrap';

describe('test/core/event/BugVersionFixHandler.test.ts', () => {
  let packageVersionAdded: PackageVersionAdded;

  before(async () => {
    packageVersionAdded = await app.getEggObject(PackageVersionAdded);
  });

  it('should trigger hook', async () => {
    app.mockLog();
    mock(app.config.cnpmcore, 'hookEnable', true);
    await packageVersionAdded.handle('banana', '1.0.0');
    app.expectLog(/TaskService\.createTask:new/);
  });

  it('should ignore hook when disable', async () => {
    app.mockLog();
    mock(app.config.cnpmcore, 'hookEnable', false);
    await packageVersionAdded.handle('banana', '1.0.0');
    app.notExpectLog(/TaskService\.createTask:new/);
  });
});
