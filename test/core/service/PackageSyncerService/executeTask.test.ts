import assert from 'assert';
import { Readable } from 'stream';
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { Package as PackageModel } from 'app/repository/model/Package';
import { Task as TaskModel } from 'app/repository/model/Task';
import { HistoryTask as HistoryTaskModel } from 'app/repository/model/HistoryTask';
import { TestUtil } from 'test/TestUtil';
import { NPMRegistry } from 'app/common/adapter/NPMRegistry';

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
      await packageSyncerService.createTask('foo', { skipDependencies: true });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      const model = await PackageModel.findOne({ scope: '', name: 'foo' });
      assert.equal(model!.isPrivate, false);
      assert(log.includes(', skipDependencies: true'));

      // sync again
      await packageSyncerService.createTask('foo');
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const manifests = await packageManagerService.listPackageFullManifests('', 'foo', undefined);
      // console.log(JSON.stringify(manifests, null, 2));
      // should have 2 maintainers
      assert.equal(manifests.data.maintainers.length, 2);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', 'foo', undefined);
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data.name, manifests.data.name);
    });

    it('should execute @node-rs/xxhash task, contains optionalDependencies', async () => {
      await packageSyncerService.createTask('@node-rs/xxhash');
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      // const stream = await packageSyncerService.findTaskLog(task) as Readable;
      // assert(stream);
      // for await (const chunk of stream) {
      //   process.stdout.write(chunk);
      // }

      const manifests = await packageManagerService.listPackageFullManifests('@node-rs', 'xxhash', undefined);
      // console.log(JSON.stringify(manifests, null, 2));
      // assert.equal(manifests.data.maintainers.length, 2);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('@node-rs', 'xxhash', undefined);
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data.name, manifests.data.name);
      assert(abbreviatedManifests.data.versions['1.0.1'].optionalDependencies);
    });

    it('should sync cnpmcore-test-sync-deprecated', async () => {
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      // const stream = await packageSyncerService.findTaskLog(task) as Readable;
      // assert(stream);
      // for await (const chunk of stream) {
      //   process.stdout.write(chunk);
      // }
      const manifests = await packageManagerService.listPackageFullManifests('', name, undefined);
      assert.equal(manifests.data.versions['0.0.0'].deprecated, 'only test for cnpmcore');
      assert.equal(manifests.data.versions['0.0.0']._hasShrinkwrap, false);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name, undefined);
      assert.equal(abbreviatedManifests.data.versions['0.0.0'].deprecated, 'only test for cnpmcore');
      assert.equal(abbreviatedManifests.data.versions['0.0.0']._hasShrinkwrap, false);
    });

    it('should sync cnpmcore-test-sync-dependencies => cnpmcore-test-sync-deprecated', async () => {
      let name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] Add dependency "cnpmcore-test-sync-deprecated" sync task: '));

      // will sync cnpmcore-test-sync-deprecated
      name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Sync cause by "cnpmcore-test-sync-dependencies" dependencies, parent task: '));
    });

    it('should sync sourceRegistryIsCNpm = true', async () => {
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] Add dependency "cnpmcore-test-sync-deprecated" sync task: '));
      assert(log.includes('][UP] 🚧🚧🚧🚧🚧 Waiting sync "cnpmcore-test-sync-dependencies" task on https://r.cnpmjs.org 🚧'));
      assert(log.includes('][UP] 🟢🟢🟢🟢🟢 https://r.cnpmjs.org/cnpmcore-test-sync-dependencies 🟢'));
    });

    it('should sync sourceRegistryIsCNpm = true and mock createSyncTask error', async () => {
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock.error(NPMRegistry.prototype, 'createSyncTask');
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚮 give up 🚮 ❌❌❌❌❌'));
      assert(log.includes(`][UP] ❌ Sync ${name} fail, create sync task error:`));
    });

    it('should sync sourceRegistryIsCNpm = true and mock createSyncTask return missing logId', async () => {
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock.data(NPMRegistry.prototype, 'createSyncTask', { data: { ok: true }, res: {} });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚮 give up 🚮 ❌❌❌❌❌'));
      assert(log.includes(`][UP] ❌ Sync ${name} fail, missing logId`));
    });

    it('should sync sourceRegistryIsCNpm = true and mock getSyncTask syncDone = false', async () => {
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'sourceRegistrySyncTimeout', 10000);
      let first = true;
      mock(NPMRegistry.prototype, 'getSyncTask', async () => {
        if (!first) {
          throw new Error('mock error');
        }
        first = false;
        return { data: { syncDone: false }, res: {}, status: 200 };
      });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚮 give up 🚮 ❌❌❌❌❌'));
      assert(log.includes('][UP] 🚧 HTTP [200]'));
      assert.match(log, /\]\[UP\] 🚧 HTTP \[unknow\] \[\d+ms\] error: /);
    });

    it('should sync sourceRegistryIsCNpm = true and mock sync upstream timeout', async () => {
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'sourceRegistrySyncTimeout', -1);
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚮 give up 🚮 ❌❌❌❌❌'));
      assert(log.includes(`][UP] ❌ Sync ${name} fail, timeout`));
    });

    it('should mock getFullManifests error', async () => {
      mock.error(NPMRegistry.prototype, 'getFullManifests');
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes(`❌ Synced ${name} fail, request manifests error`));
    });

    it('should mock getFullManifests Invalid maintainers error', async () => {
      mock.data(NPMRegistry.prototype, 'getFullManifests', {
        data: {
          maintainers: [{ name: 'foo' }],
        },
        res: {},
        headers: {},
      });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ Invalid maintainers: '));
    });

    it('should mock getFullManifests missing tarball error and downloadTarball error', async () => {
      mock.error(NPMRegistry.prototype, 'downloadTarball');
      mock.data(NPMRegistry.prototype, 'getFullManifests', {
        data: {
          maintainers: [{ name: 'fengmk2', email: 'fengmk2@gmai.com' }],
          versions: {
            '1.0.0': {
              version: '1.0.0',
              dist: { tarball: '' },
            },
            '2.0.0': {
              version: '2.0.0',
              dist: { tarball: 'https://foo.com/a.tgz' },
            },
          },
        },
        res: {},
        headers: {},
      });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ Synced version 1.0.0 fail, missing tarball, dist: '));
      assert(log.includes('❌ All versions sync fail, package not exists'));
      assert(log.includes('❌ Synced version 2.0.0 fail, download tarball error'));
    });

    it('should mock downloadTarball status !== 200', async () => {
      mock.data(NPMRegistry.prototype, 'downloadTarball', {
        status: 404,
        res: {},
        headers: {},
        localFile: __filename + '__not_exists',
      });
      mock.data(NPMRegistry.prototype, 'getFullManifests', {
        data: {
          maintainers: [{ name: 'fengmk2', email: 'fengmk2@gmai.com' }],
          versions: {
            '2.0.0': {
              version: '2.0.0',
              dist: { tarball: 'https://foo.com/a.tgz' },
            },
          },
        },
        res: {},
        headers: {},
      });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ All versions sync fail, package not exists'));
      assert(log.includes('❌ Synced version 2.0.0 fail, download tarball status error'));
    });

    it('should sync mk2test-module-cnpmsync with different metas', async () => {
      const name = 'mk2test-module-cnpmsync';
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      await TestUtil.createPackage({ name, version: '2.0.0', isPrivate: false });
      await packageSyncerService.createTask(name, { tips: 'sync test tips here' });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🟢 Synced version 2.0.0 success, different meta: {"peerDependenciesMeta":{"bufferutil":{"optional":true},"utf-8-validate":{"optional":true}},"os":["linux"],"cpu":["x64"]}'));
      assert(log.includes('Z] 👉👉👉👉👉 Tips: sync test tips here 👈👈👈👈👈'));
      assert(log.includes(', skipDependencies: false'));
      const manifests = await packageManagerService.listPackageFullManifests('', name, undefined);
      assert.equal(manifests.data.versions['2.0.0'].peerDependenciesMeta.bufferutil.optional, true);
      assert.equal(manifests.data.versions['2.0.0'].os[0], 'linux');
      assert.equal(manifests.data.versions['2.0.0'].cpu[0], 'x64');
      // publishTime
      assert.equal(manifests.data.time['1.0.0'], '2021-09-27T08:10:48.747Z');
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name, undefined);
      // console.log(JSON.stringify(abbreviatedManifests.data, null, 2));
      assert.equal(abbreviatedManifests.data.versions['2.0.0'].peerDependenciesMeta.bufferutil.optional, true);
      assert.equal(abbreviatedManifests.data.versions['2.0.0'].os[0], 'linux');
      assert.equal(abbreviatedManifests.data.versions['2.0.0'].cpu[0], 'x64');

      // again should skip sync different metas
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task) as Readable;
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('🟢 Synced version 2.0.0 success, different meta:'));
    });
  });
});
