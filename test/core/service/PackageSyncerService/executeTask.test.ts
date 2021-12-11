import assert from 'assert';
import { Readable } from 'stream';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { Package as PackageModel } from 'app/repository/model/Package';
import { Task as TaskModel } from 'app/repository/model/Task';
import { HistoryTask as HistoryTaskModel } from 'app/repository/model/HistoryTask';

describe('test/core/service/PackageSyncerService/executeTask.test.ts', () => {
  let ctx: Context;
  let packageSyncerService: PackageSyncerService;
  let packageManagerService: PackageManagerService;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    packageSyncerService = await ctx.getEggObject(PackageSyncerService);
    packageManagerService = await ctx.getEggObject(PackageManagerService);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
  });

  describe('executeTask()', () => {
    it('should execute foo task', async () => {
      await packageSyncerService.createTask('foo', '', '');
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task, false);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      let stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }
      const model = await PackageModel.findOne({ scope: '', name: 'foo' });
      assert.equal(model!.isPrivate, false);

      // sync again
      await packageSyncerService.createTask('foo', '', '');
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }

      const manifests = await packageManagerService.listPackageFullManifests('', 'foo', undefined);
      // console.log(JSON.stringify(manifests, null, 2));
      // should have 2 maintainers
      assert.equal(manifests.data.maintainers.length, 2);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', 'foo', undefined);
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data.name, manifests.data.name);
    });

    it('should execute @node-rs/xxhash task, contains optionalDependencies', async () => {
      await packageSyncerService.createTask('@node-rs/xxhash', '', '');
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }

      const manifests = await packageManagerService.listPackageFullManifests('@node-rs', 'xxhash', undefined);
      // console.log(JSON.stringify(manifests, null, 2));
      // assert.equal(manifests.data.maintainers.length, 2);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('@node-rs', 'xxhash', undefined);
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data.name, manifests.data.name);
      assert(abbreviatedManifests.data.versions['1.0.1'].optionalDependencies);
    });
  });
});
