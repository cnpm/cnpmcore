import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageSyncerService } from '../../../../app/core/service/PackageSyncerService';
import { PackageManagerService } from '../../../../app/core/service/PackageManagerService';
import { Package as PackageModel } from '../../../../app/repository/model/Package';
import { Task as TaskModel } from '../../../../app/repository/model/Task';
import { Task as TaskEntity } from '../../../../app/core/entity/Task';
import { HistoryTask as HistoryTaskModel } from '../../../../app/repository/model/HistoryTask';
import { NPMRegistry } from '../../../../app/common/adapter/NPMRegistry';
import { NFSAdapter } from '../../../../app/common/adapter/NFSAdapter';
import { getScopeAndName } from '../../../../app/common/PackageUtil';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import { Registry } from '../../../../app/core/entity/Registry';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { TaskService } from '../../../../app/core/service/TaskService';
import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService';
import { UserService } from '../../../../app/core/service/UserService';
import { ChangeRepository } from '../../../../app/repository/ChangeRepository';
import { PackageVersion } from '../../../../app/repository/model/PackageVersion';
import { TaskState } from '../../../../app/common/enum/Task';

describe('test/core/service/PackageSyncerService/executeTask.test.ts', () => {
  let packageSyncerService: PackageSyncerService;
  let packageManagerService: PackageManagerService;
  let packageRepository: PackageRepository;
  let npmRegistry: NPMRegistry;
  let registryManagerService: RegistryManagerService;
  let taskService: TaskService;
  let scopeManagerService: ScopeManagerService;
  let userService: UserService;
  let changeRepository: ChangeRepository;

  beforeEach(async () => {
    packageSyncerService = await app.getEggObject(PackageSyncerService);
    packageManagerService = await app.getEggObject(PackageManagerService);
    packageRepository = await app.getEggObject(PackageRepository);
    npmRegistry = await app.getEggObject(NPMRegistry);
    taskService = await app.getEggObject(TaskService);
    registryManagerService = await app.getEggObject(RegistryManagerService);
    scopeManagerService = await app.getEggObject(ScopeManagerService);
    userService = await app.getEggObject(UserService);
    changeRepository = await app.getEggObject(ChangeRepository);
  });

  describe('executeTask()', () => {
    it('should execute "foobar" task', async () => {
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
        persist: false,
        repeats: 2,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz'),
        persist: false,
      });
      await packageSyncerService.createTask('foobar', { skipDependencies: true });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      const model = await PackageModel.findOne({ scope: '', name: 'foobar' });
      assert.equal(model!.isPrivate, false);
      assert(log.includes(', skipDependencies: true'));

      // sync again
      await packageSyncerService.createTask('foobar');
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const manifests = await packageManagerService.listPackageFullManifests('', 'foobar');
      // console.log(JSON.stringify(manifests, null, 2));
      // should have 2 maintainers
      assert(manifests.data!.maintainers.length >= 1);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', 'foobar');
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data!.name, manifests.data!.name);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should resync history version if forceSyncHistory is true', async () => {
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
        persist: false,
        repeats: 2,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
        repeats: 2,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz'),
        persist: false,
        repeats: 2,
      });
      await packageSyncerService.createTask('foobar', { skipDependencies: true });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);

      await packageSyncerService.createTask('foobar', { forceSyncHistory: true, skipDependencies: true });
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream2 = await packageSyncerService.findTaskLog(task);
      assert(stream2);
      const log2 = await TestUtil.readStreamToLog(stream2);
      // console.log(log2);
      assert(/Remove version 1\.0\.0 for force sync history/.test(log2));
      assert(/Syncing version 1\.0\.0/.test(log2));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should not sync dependencies where task queue length too high', async () => {
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'taskQueueHighWaterSize', 2);
      await packageSyncerService.createTask('foobar', { skipDependencies: false });
      await packageSyncerService.createTask('foo', { skipDependencies: false });
      await packageSyncerService.createTask('bar', { skipDependencies: false });
      await packageSyncerService.createTask('foobarfoo', { skipDependencies: false });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, 'foobar');
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      const model = await PackageModel.findOne({ scope: '', name: 'foobar' });
      assert.equal(model!.isPrivate, false);
      assert(log.includes(', taskQueue: 3/2'));
      assert(log.includes(', skipDependencies: true'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should execute @node-rs/xxhash task, contains optionalDependencies', async () => {
      app.mockHttpclient('https://registry.npmjs.org/%40node-rs%2Fxxhash', 'GET', {
        data: '{"_id":"@node-rs/xxhash","_rev":"12-c16041461d207648f8785b03ff497026","name":"@node-rs/xxhash","dist-tags":{"latest":"1.2.1","depracated":"1.1.2"},"versions":{"1.0.0":{"name":"@node-rs/xxhash","version":"1.0.0","description":"Fastest xxhash implementation in Node.js","keywords":["hash","xxhash","xxhashjs","Rust","node-rs","napi","napi-rs","N-API","Node-API"],"author":{"name":"LongYinan","email":"lynweklm@gmail.com"},"homepage":"https://github.com/napi-rs/node-rs","license":"MIT","main":"index.js","typings":"index.d.ts","napi":{"name":"xxhash","triples":{"defaults":true,"additional":["i686-pc-windows-msvc","x86_64-unknown-linux-musl","aarch64-unknown-linux-gnu","armv7-unknown-linux-gnueabihf","aarch64-apple-darwin","aarch64-linux-android","x86_64-unknown-freebsd","aarch64-unknown-linux-musl","aarch64-pc-windows-msvc"]}},"engines":{"node":">= 12"},"publishConfig":{"registry":"https://registry.npmjs.org/","access":"public"},"repository":{"type":"git","url":"git+https://github.com/napi-rs/node-rs.git"},"scripts":{"artifacts":"napi artifacts -d ../../artifacts","bench":"cross-env NODE_ENV=production node benchmark/xxhash.js","build":"napi build --platform --release","build:debug":"napi build --platform","prepublishOnly":"napi prepublish","version":"napi version"},"dependencies":{"@node-rs/helper":"^1.2.1","@node-rs/xxhash-win32-x64-msvc":"1.0.0","@node-rs/xxhash-darwin-x64":"1.0.0","@node-rs/xxhash-linux-x64-gnu":"1.0.0","@node-rs/xxhash-win32-ia32-msvc":"1.0.0","@node-rs/xxhash-linux-x64-musl":"1.0.0","@node-rs/xxhash-linux-arm64-gnu":"1.0.0","@node-rs/xxhash-linux-arm-gnueabihf":"1.0.0","@node-rs/xxhash-darwin-arm64":"1.0.0","@node-rs/xxhash-android-arm64":"1.0.0","@node-rs/xxhash-freebsd-x64":"1.0.0","@node-rs/xxhash-linux-arm64-musl":"1.0.0","@node-rs/xxhash-win32-arm64-msvc":"1.0.0"},"devDependencies":{"@types/xxhashjs":"^0.2.2","webpack":"^5.59.1","xxhash":"^0.3.0","xxhashjs":"^0.2.2"},"funding":{"type":"github","url":"https://github.com/sponsors/Brooooooklyn"},"gitHead":"dd157413b2c918c5d29c0d47071606bfabbddb64","optionalDependencies":{"@node-rs/xxhash-win32-x64-msvc":"1.0.0","@node-rs/xxhash-darwin-x64":"1.0.0","@node-rs/xxhash-linux-x64-gnu":"1.0.0","@node-rs/xxhash-win32-ia32-msvc":"1.0.0","@node-rs/xxhash-linux-x64-musl":"1.0.0","@node-rs/xxhash-linux-arm64-gnu":"1.0.0","@node-rs/xxhash-linux-arm-gnueabihf":"1.0.0","@node-rs/xxhash-darwin-arm64":"1.0.0","@node-rs/xxhash-android-arm64":"1.0.0","@node-rs/xxhash-freebsd-x64":"1.0.0","@node-rs/xxhash-linux-arm64-musl":"1.0.0","@node-rs/xxhash-win32-arm64-msvc":"1.0.0"},"_id":"@node-rs/xxhash@1.0.0","_nodeVersion":"14.18.1","_npmVersion":"lerna/4.0.0/node@v14.18.1+x64 (linux)","dist":{"integrity":"sha512-wVhbJT3QumfE7zlMLAZoAllaUufN5r3ia8vatKaqcG/Bau9SdFmcZpo8IuWDfSX+Jqyh9dViSRpUYChrVUvyFw==","shasum":"8c9a8c3be47b82de1a5cb42b2d38f652520bf73c","tarball":"https://registry.npmjs.org/@node-rs/xxhash/-/xxhash-1.0.0.tgz","fileCount":5,"unpackedSize":10143,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEUCIQD+Dksaw6q6YpTDITfpfAwI15qCuQT84NvQKOpMqq4ZdQIgHvVlZ7+kJk4gzGM7hD10eILXlpOfqQa6Z6NZtcOvX+M="}]},"_npmUser":{"name":"broooooklyn","email":"lynweklm@gmail.com"},"directories":{},"maintainers":[{"name":"broooooklyn","email":"lynweklm@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/xxhash_1.0.0_1634889276349_0.690262990489863"},"_hasShrinkwrap":false}},"time":{"created":"2021-10-22T07:54:36.303Z","1.0.0":"2021-10-22T07:54:36.493Z","modified":"2022-05-14T10:40:20.461Z"},"maintainers":[{"name":"dxd_sjtu","email":"dxd_sjtu@outlook.com"},{"name":"broooooklyn","email":"lynweklm@gmail.com"}],"description":"Fastest xxhash implementation in Node.js","homepage":"https://github.com/napi-rs/node-rs","keywords":["hash","xxhash","xxhashjs","Rust","node-rs","napi","napi-rs","N-API","Node-API"],"repository":{"type":"git","url":"git+https://github.com/napi-rs/node-rs.git"},"author":{"name":"LongYinan","email":"lynweklm@gmail.com"},"bugs":{"url":"https://github.com/napi-rs/node-rs/issues"},"license":"MIT","readme":"mock readme","readmeFilename":"README.md"}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@node-rs/xxhash/-/xxhash-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      await packageSyncerService.createTask('@node-rs/xxhash');
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert(!await TaskModel.findOne({ taskId: task.taskId }));
      assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));

      const manifests = await packageManagerService.listPackageFullManifests('@node-rs', 'xxhash');
      // console.log(JSON.stringify(manifests, null, 2));
      // assert.equal(manifests.data.maintainers.length, 2);
      const abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('@node-rs', 'xxhash');
      // console.log(JSON.stringify(abbreviatedManifests, null, 2));
      assert.equal(abbreviatedManifests.data!.name, manifests.data!.name);
      assert(abbreviatedManifests.data!.versions['1.0.0']);
      assert(abbreviatedManifests.data!.versions['1.0.0'].optionalDependencies);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync cnpmcore-test-sync-deprecated and mock 404', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let manifests = await packageManagerService.listPackageFullManifests('', name);
      assert(manifests.data);
      assert(manifests!.data!.versions['0.0.0']);

      assert.equal(manifests.data.versions['0.0.0'].deprecated, 'only test for cnpmcore');
      assert.equal(manifests.data.versions['0.0.0']._hasShrinkwrap, false);
      let abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert.equal(abbreviatedManifests!.data!.versions['0.0.0']!.deprecated, 'only test for cnpmcore');
      assert.equal(abbreviatedManifests!.data!.versions['0.0.0']!._hasShrinkwrap, false);
      app.mockAgent().assertNoPendingInterceptors();

      // mock 404 and unpublished
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        status: 404,
        data: '{"error":"Not found"}',
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`] 🟢 Package "${name}" was removed in remote registry`));

      manifests = await packageManagerService.listPackageFullManifests('', name);
      assert(manifests.data);
      assert(manifests.data.time.unpublished);
      abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert(abbreviatedManifests.data!.time!.unpublished);
      app.mockAgent().assertNoPendingInterceptors();

      // sync again
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      manifests = await packageManagerService.listPackageFullManifests('', name);
      assert(!manifests.data!.time.unpublished);
      assert.equal(manifests.data!.versions['0.0.0']!.deprecated, 'only test for cnpmcore');
      assert.equal(manifests.data!.versions['0.0.0']!._hasShrinkwrap, false);
      abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert(!abbreviatedManifests.data!.time?.unpublished);
      assert.equal(abbreviatedManifests.data!.versions['0.0.0']!.deprecated, 'only test for cnpmcore');
      assert.equal(abbreviatedManifests.data!.versions['0.0.0']!._hasShrinkwrap, false);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync fail when package not exists', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-package-not-exists', 'GET', {
        status: 404,
        data: '{"error":"Not found"}',
        persist: false,
      });
      const name = 'cnpmcore-test-sync-package-not-exists';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] ❌ Package not exists, response data: '));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore PositionNotEqualToLength error', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org//foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const err = {
        name: 'PositionNotEqualToLengthError',
        message: 'Position is not equal to file length',
        code: 'PositionNotEqualToLength',
        status: '409',
      };
      mock.error(NFSAdapter.prototype, 'appendBytes', err);
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🔗'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore ObjectNotAppendable error', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const err = {
        name: 'ObjectNotAppendableError',
        message: 'The object is not appendable',
        code: 'ObjectNotAppendable',
        status: '409',
      };
      mock.error(NFSAdapter.prototype, 'appendBytes', err);
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🔗'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync cnpmcore-test-sync-dependencies => cnpmcore-test-sync-deprecated', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-dependencies.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies/-/cnpmcore-test-sync-dependencies-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      let name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 📦 Add dependency "cnpmcore-test-sync-deprecated" sync task: '));

      // will sync cnpmcore-test-sync-deprecated
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Sync cause by "cnpmcore-test-sync-dependencies" dependencies, parent task: '));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync cnpmcore-test-sync-dependencies => cnpmcore-test-sync-deprecated and not add dependencies', async () => {
      let name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);

      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-dependencies.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies/-/cnpmcore-test-sync-dependencies-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      name = 'cnpmcore-test-sync-dependencies';
      const task = await packageSyncerService.createTask(name);
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('] 📦 Add dependency "cnpmcore-test-sync-deprecated" sync task: '));
      assert(log.includes('] 📖 Has dependency "cnpmcore-test-sync-deprecated" sync task: '));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync package optionalDependencies', async () => {
      const name = 'resvg-js';
      const task = await packageSyncerService.createTask(name);
      app.mockHttpclient('https://registry.npmjs.org/resvg-js', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/resvg-js.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/resvg-js/-/resvg-js-2.4.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 📦 Add dependency "@resvg/resvg-js-win32-x64-msvc" sync task: '));
    });

    it('should bring auth token which in registry database.', async () => {
      const testToken = 'test-auth-token';
      const registry = await registryManagerService.ensureDefaultRegistry();
      await registryManagerService.updateRegistry(registry.registryId, { ...registry, authToken: testToken });
      const fullManifests = await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json');
      const tgzBuffer1_0_0 = await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz');
      const tgzBuffer1_1_0 = await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz');

      let fullManifestsHeader;
      let tgzBuffer1_0_0Header;
      let tgzBuffer1_1_0Header;
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', (_, opts) => {
        fullManifestsHeader = opts.headers;
        return {
          data: fullManifests,
          persist: false,
          repeats: 2,
        };
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', (_, opts) => {
        tgzBuffer1_0_0Header = opts.headers;
        return {
          data: tgzBuffer1_0_0,
          persist: false,
        };
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', (_, opts) => {
        tgzBuffer1_1_0Header = opts.headers;
        return {
          data: tgzBuffer1_1_0,
          persist: false,
        };
      });
      await packageSyncerService.createTask('foobar', { skipDependencies: true });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      assert.equal(fullManifestsHeader?.authorization, `Bearer ${testToken}`);
      assert.equal(tgzBuffer1_0_0Header?.authorization, `Bearer ${testToken}`);
      assert.equal(tgzBuffer1_1_0Header?.authorization, `Bearer ${testToken}`);
    });

    it('should ignore publish error on sync task', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      mock.error(packageManagerService.constructor.prototype, 'publish');
      const task = await packageSyncerService.createTask(name);
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('❌ [1] Synced version 0.0.0 error, publish error: MockError: mm mock error'));
      assert(log.includes('❌ All versions sync fail, package not exists'));

      const res = await app.httpRequest()
        .get(`/-/package/${name}/syncs/${task.taskId}`)
        .expect(200);
      assert.equal(res.body.state, 'fail');
      assert.equal(res.body.error, 'publish error: MockError: mm mock error');
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore when all version publish ForbiddenError', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      const err = new Error('mock ForbiddenError');
      err.name = 'ForbiddenError';
      mock.error(packageManagerService.constructor.prototype, 'publish', err);
      const task = await packageSyncerService.createTask(name);
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('🐛 [1] Synced version 0.0.0 already exists, skip publish, try to set in local manifest'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore download error error on sync task', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        status: 500,
        data: 'mock request error',
        persist: false,
        repeats: 3,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      const task = await packageSyncerService.createTask(name);
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      app.mockAgent().assertNoPendingInterceptors();
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('❌ [1] Synced version 0.0.0 fail, download tarball error: DownloadStatusInvalidError: Download https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz status(500) invalid'));
      assert(log.includes('❌ All versions sync fail, package not exists'));
    });

    describe('sync version idempotence', async () => {
      beforeEach(async () => {
        app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
          data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
          persist: false,
          repeats: 2,
        });
        app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
          persist: false,
        });
        app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
          persist: false,
        });
      });

      it('should sync 2 versions package: @cnpmcore/test-sync-package-has-two-versions', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        let task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        await packageSyncerService.executeTask(task);
        let stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        let log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('] 🟢 Synced updated 2 versions, removed 0 versions'));
        assert(log.includes('] 🚧 Syncing versions 0 => 2'));

        // mock listPackageFullManifests return only one version
        // 如果 version publish 同步中断了，没有刷新 manifests，会导致下一次同步重新 version publish，然后报错
        // Avoid: Can't modify pre-existing version: 1.0.0
        const scopedAndName = getScopeAndName(name);
        const manifests = await packageManagerService.listPackageFullManifests(scopedAndName[0], scopedAndName[1]);
        assert(manifests.data);
        delete manifests.data.versions['1.0.0'];
        mock.data(PackageManagerService.prototype, 'listPackageFullManifests', manifests);

        await packageSyncerService.createTask(name);
        task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        await packageSyncerService.executeTask(task);
        stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('Synced version 1.0.0 already exists, skip publish, try to set in local manifest'));
        assert(log.includes('] 🟢 Synced updated'));
        assert(log.includes('] 🚧 Syncing versions 1 => 2'));
        app.mockAgent().assertNoPendingInterceptors();
        await mock.restore();

        app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
          data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
          persist: false,
        });
        const abbrs = await packageManagerService.listPackageAbbreviatedManifests(scopedAndName[0], scopedAndName[1]);
        assert(abbrs.data);
        delete abbrs.data.versions['1.0.0'];
        mock.data(PackageManagerService.prototype, 'listPackageAbbreviatedManifests', abbrs);

        await packageSyncerService.createTask(name);
        task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        await packageSyncerService.executeTask(task);
        stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('] 🐛 Remote version 1.0.0 not exists on local abbreviated manifests, need to refresh'));
        assert(log.includes('] 🟢 Synced updated'));
        assert(log.includes('] 🚧 Syncing versions 2 => 2'));
        app.mockAgent().assertNoPendingInterceptors();
        await mock.restore();

        // mock tag on database but not on manifest dist
        // https://github.com/cnpm/cnpmcore/issues/97
        app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
          data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
          persist: false,
        });
        const result = await npmRegistry.getFullManifests(name);
        const latestVersion = result.data['dist-tags'].latest;
        result.data['dist-tags'].foo = '2.0.0';
        mock.data(NPMRegistry.prototype, 'getFullManifests', result);
        mock.data(PackageManagerService.prototype, 'savePackageTag', null);
        await packageSyncerService.createTask(name);
        task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('] 🚧 Remote tag(foo: 2.0.0) not exists in local dist-tags'));
        assert(!log.includes('] 🚧 Refreshing manifests to dists ......'));
        assert(log.includes('] 🚧 Syncing versions 2 => 2'));
        assert(log.includes(`] 📖 @cnpmcore/test-sync-package-has-two-versions latest version: ${latestVersion}, published time: ${JSON.stringify(result.data.time[latestVersion])}`));
        app.mockAgent().assertNoPendingInterceptors();
      });

      it('should updated package manifests when version already published', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);

        const { user } = await userService.create({
          name: 'test-user',
          password: 'this-is-password',
          email: 'hello@example.com',
          ip: '127.0.0.1',
        });

        const publishCmd = {
          scope: '@cnpmcore',
          name: 'test-sync-package-has-two-versions',
          version: '1.0.0',
          description: '1.0.0',
          readme: '',
          registryId: undefined,
          packageJson: { name, test: 'test', version: '1.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: false,
        };
        const pkgVersion = await packageManagerService.publish(publishCmd, user);
        assert(pkgVersion.version === '1.0.0');

        const publishCmd2 = {
          scope: '@cnpmcore',
          name: 'test-sync-package-has-two-versions',
          version: '2.0.0',
          description: '2.0.0',
          readme: '',
          registryId: undefined,
          packageJson: { name, test: 'test', version: '2.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: true,
        };
        const pkgVersion2 = await packageManagerService.publish(publishCmd2, user);
        assert(pkgVersion2.version === '2.0.0');

        await packageSyncerService.executeTask(task);

        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('Synced version 2.0.0 already exists, skip publish, try to set in local manifest'));
        assert(log.includes('] 🚧 Syncing versions 1 => 2'));

        const fullManifests = await packageManagerService.listPackageFullManifests('@cnpmcore', 'test-sync-package-has-two-versions');
        assert(fullManifests.data);
        assert(fullManifests.data.versions['2.0.0']);

      });

      it('should skip self registry', async () => {
        const name = '@cnpmcore/test-self-sync';
        const { user } = await userService.create({
          name: 'test-user',
          password: 'this-is-password',
          email: 'hello@example.com',
          ip: '127.0.0.1',
        });

        const registry = await registryManagerService.ensureSelfRegistry();

        const publishCmd = {
          scope: '@cnpmcore',
          name: 'test-self-sync',
          version: '1.0.0',
          description: '1.0.0',
          readme: '',
          registryId: registry.registryId,
          packageJson: { name, test: 'test', version: '1.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: false,
        };
        const pkgVersion = await packageManagerService.publish(publishCmd, user);
        assert(pkgVersion.version === '1.0.0');

        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);

        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes(`${name} has been published to the self registry, skip sync ❌❌❌❌❌`));

      });

      it('should updated package manifests when version insert duplicated', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);

        const { user } = await userService.create({
          name: 'test-user',
          password: 'this-is-password',
          email: 'hello@example.com',
          ip: '127.0.0.1',
        });

        const publishCmd = {
          scope: '@cnpmcore',
          name: 'test-sync-package-has-two-versions',
          version: '1.0.0',
          description: '1.0.0',
          readme: '',
          registryId: undefined,
          packageJson: { name, test: 'test', version: '1.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: false,
        };
        const pkgVersion = await packageManagerService.publish(publishCmd, user);
        assert(pkgVersion.version === '1.0.0');

        const publishCmd2 = {
          scope: '@cnpmcore',
          name: 'test-sync-package-has-two-versions',
          version: '2.0.0',
          description: '2.0.0',
          readme: '',
          registryId: undefined,
          packageJson: { name, test: 'test', version: '2.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: true,
        };
        const pkgVersion2 = await packageManagerService.publish(publishCmd2, user);
        assert(pkgVersion2.version === '2.0.0');

        // 模拟查询未发现版本重复，写入时异常
        mock(packageRepository, 'findPackageVersion', async () => {
          return null;
        });
        await packageSyncerService.executeTask(task);

        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('Synced version 2.0.0 already exists, skip publish, try to set in local manifest'));
        assert(log.includes('] 🚧 Syncing versions 1 => 2'));

      });

      it('should skip version when insert error', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        const { user } = await userService.create({
          name: 'test-user',
          password: 'this-is-password',
          email: 'hello@example.com',
          ip: '127.0.0.1',
        });

        const publishCmd = {
          scope: '@cnpmcore',
          name: 'test-sync-package-has-two-versions',
          version: '1.0.0',
          description: '1.0.0',
          readme: '',
          registryId: undefined,
          packageJson: { name, test: 'test', version: '1.0.0' },
          dist: {
            content: Buffer.alloc(0),
          },
          isPrivate: false,
          publishTime: new Date(),
          skipRefreshPackageManifests: false,
        };
        const pkgVersion = await packageManagerService.publish(publishCmd, user);
        assert(pkgVersion.version === '1.0.0');

        // 模拟查询未发现版本重复，写入时异常
        mock(packageRepository, 'findPackageVersion', async () => {
          return null;
        });

        mock(packageRepository, 'createPackageVersion', async () => {
          throw new Error('mock error');
        });
        await packageSyncerService.executeTask(task);

        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log.includes(' Synced updated 0 versions, removed 0 versions'));

      });

      it('event cork should work', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);


        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);

        const finishedTask = await taskService.findTask(task.taskId) as TaskEntity;

        const changes = await changeRepository.query(0, 100);
        const [ firstChange ] = changes;
        const firstChangeDate = new Date(firstChange.createdAt);
        const taskFinishedDate = new Date(finishedTask!.updatedAt);

        // 任务结束后一起触发
        assert(firstChangeDate.getTime() - taskFinishedDate.getTime() > 0);

      });

      it('should bulk update maintainer dist', async () => {
        // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
        const name = '@cnpmcore/test-sync-package-has-two-versions';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        let called = 0;

        mock(packageManagerService, 'refreshPackageMaintainersToDists', async () => {
          called++;
        });
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);

        const finishedTask = await taskService.findTask(task.taskId) as TaskEntity;

        assert.equal(finishedTask.state, TaskState.Success);
        assert.equal(called, 1);

      });

    });

    it.skip('should sync missing versions in database', async () => {
      // https://www.npmjs.com/package/@cnpmcore/test-sync-package-has-two-versions
      const name = '@cnpmcore/test-sync-package-has-two-versions';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🟢 Synced updated 2 versions, removed 0 versions'));
      assert(log.includes('] 🚧 Syncing versions 0 => 2'));

      const pkg = await packageRepository.findPackage('@cnpmcore', 'test-sync-package-has-two-versions');
      assert(pkg);
      await packageRepository.removePackageVersions(pkg.packageId);

      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('] 🟢 Synced updated 0 versions, removed 0 versions'));
      assert(log.includes('] 🐛 Remote version 1.0.0 not exists on database'));
      assert(log.includes('] 🐛 Remote version 2.0.0 not exists on database'));
      assert(log.includes('] 🚧 Syncing versions 2 => 2'));
    });

    it('should sync removed versions', async () => {
      app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
        data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = '@cnpmcore/test-sync-package-has-two-versions';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🟢 Synced updated 2 versions'));
      app.mockAgent().assertNoPendingInterceptors();

      app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
        data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
        repeats: 2,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('removed 1 versions'));
      assert(log.includes('] 🟢 Removed version 1.0.0 success'));
      const r = await packageManagerService.listPackageFullManifests('@cnpmcore', 'test-sync-package-has-two-versions');
      assert(Object.keys(r.data!.versions).length === 1);
      assert(!r.data!.versions['1.0.0'], '1.0.0 should not exists');
    });

    it('should work on unpublished package', async () => {
      app.mockHttpclient('https://registry.npmjs.org/rollup-config-mbp', 'GET', {
        data: '{"_id":"rollup-config-mbp","name":"rollup-config-mbp","time":{"created":"2020-09-25T09:18:36.405Z","0.0.1-alpha.1":"2020-09-25T09:18:36.552Z","modified":"2022-01-14T12:34:32.620Z","unpublished":{"time":"2022-01-14T12:34:32.620Z","versions":["0.0.1-alpha.1"]}}}',
        persist: false,
      });
      let name = 'rollup-config-mbp';
      // ignore unpublished when local package not exists
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`] 🟢 Package "${name}" was removed in remote registry`));
      let data = await packageManagerService.listPackageFullManifests('', name);
      assert(data.data === null);

      // sync unpublished
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🟢 Synced '));
      data = await packageManagerService.listPackageFullManifests('', name);
      // console.log(data.data);
      assert(!data.data!.time.unpublished);
      assert(data.data!.maintainers);
      app.mockAgent().assertNoPendingInterceptors();

      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","name":"cnpmcore-test-sync-deprecated","time":{"created":"2020-09-25T09:18:36.405Z","0.0.1-alpha.1":"2020-09-25T09:18:36.552Z","modified":"2022-01-14T12:34:32.620Z","unpublished":{"time":"2022-01-14T12:34:32.620Z","versions":["0.0.1-alpha.1"]}}}',
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`] 🟢 Package "${name}" was removed in remote registry`));
      data = await packageManagerService.listPackageFullManifests('', name);
      // console.log(data.data);
      assert(data.data!.time.unpublished);
      assert(!data.data!.maintainers);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should work on mock package.readme is undefined', async () => {
      const pkg = await TestUtil.readJSONFile(TestUtil.getFixtures('registry.npmjs.org/cnpmcore-test-sync-dependencies.json'));
      delete pkg.readme;
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies', 'GET', {
        data: JSON.stringify(pkg),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-dependencies/-/cnpmcore-test-sync-dependencies-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-dependencies';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 📦 Add dependency "cnpmcore-test-sync-deprecated" sync task: '));
      const { data } = await packageManagerService.listPackageFullManifests('', name);
      assert.equal(data!.readme, '');
    });

    it('should auto sync missing hasInstallScript property', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      // https://github.com/cnpm/cnpm/issues/374
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚧 Syncing versions 0 => 1'));
      let res = await packageManagerService.listPackageFullManifests('', name);
      assert(res.data);
      assert(res.data.versions);
      assert((res.data as any).versions[res.data['dist-tags'].latest].hasInstallScript === undefined);
      app.mockAgent().assertNoPendingInterceptors();

      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","version":"0.0.0","description":"","main":"index.js","scripts":{"install":"echo 1"},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚧 Syncing versions 1 => 1'));
      assert(res.data);
      res = await packageManagerService.listPackageFullManifests('', name);
      assert(res.data!.versions?.[res.data!['dist-tags'].latest]?.hasInstallScript === true);
      const abbrRes = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert(abbrRes.data!.versions[abbrRes.data!['dist-tags'].latest]?.hasInstallScript === true);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore package.version.readme exists', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":"mock readme content","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('] 🔗 https://registry.npmjs.org/cnpmcore-test-sync-deprecated'));
      const { data } = await packageManagerService.listPackageFullManifests('', name);
      assert(data!.readme === 'mock readme content');
      assert(data!.versions['0.0.0']!.readme === undefined);
    });

    it('should work on mock package.readme is object', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const data = await packageManagerService.listPackageFullManifests('', name);
      assert.equal(data!.data!.readme, '{"foo":"mock readme is object"}');
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync dist-tags change', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('[1] Synced version 0.0.0 success'));
      assert(log.includes('🟢 Synced 1 tags: [{"action":"change","tag":"latest","version":"0.0.0"}]'));
      let data = await packageManagerService.listPackageFullManifests('', name);
      assert.deepEqual(data!.data!['dist-tags'], { latest: '0.0.0' });

      // update tags, add beta tag
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0","beta":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });

      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('[1] Synced version 0.0.0 success'));
      assert(log.includes('🟢 Synced 1 tags: [{"action":"change","tag":"beta","version":"0.0.0"}]'));
      data = await packageManagerService.listPackageFullManifests('', name);
      assert(data.data);
      assert.deepEqual(data.data['dist-tags'], { latest: '0.0.0', beta: '0.0.0' });

      // all tags exists
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0","beta":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('[1] Synced version 0.0.0 success'));
      assert(!log.includes('🟢 Synced 1 tags: '));
      data = await packageManagerService.listPackageFullManifests('', name);
      assert.deepEqual(data!.data!['dist-tags'], { latest: '0.0.0', beta: '0.0.0' });

      // sync remove beta tags
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIFqvSEQ9eD3eZ09kfQOKO1j6LnjPeqAfbyYLWlEpxmJHAiAzD+2a4RHF8Vu5N+2wT4kagARnRb47FqpgD08elWVBgA=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/cnpmcore-test-sync-deprecated_0.0.0_1639246164624_0.5739637441745657"},"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('[1] Synced version 0.0.0 success'));
      assert(log.includes('Synced 1 tags: [{"action":"remove","tag":"beta"}]'));
      data = await packageManagerService.listPackageFullManifests('', name);
      assert(data.data);
      assert.deepEqual(data.data['dist-tags'], { latest: '0.0.0' });
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should only sync specific version when strictSyncSpecivicVersion is true.', async () => {
      mock(app.config.cnpmcore, 'strictSyncSpecivicVersion', true);
      app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
        data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = '@cnpmcore/test-sync-package-has-two-versions';
      await packageSyncerService.createTask(name, { specificVersions: [ '1.0.0' ] });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('] 🟢 Synced updated 1 versions'));
      assert(app.mockAgent().pendingInterceptors().length === 1);
    });

    it('should sync specific versions and latest version.', async () => {
      app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
        data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = '@cnpmcore/test-sync-package-has-two-versions';
      await packageSyncerService.createTask(name, { specificVersions: [ '1.0.0' ] });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('] 🟢 Synced updated 2 versions'));
      assert(app.mockAgent().pendingInterceptors().length === 0);
    });

    it('should sync specific versions and latest version.', async () => {
      app.mockHttpclient('https://registry.npmjs.org/%40cnpmcore%2Ftest-sync-package-has-two-versions', 'GET', {
        data: '{"_id":"@cnpmcore/test-sync-package-has-two-versions","_rev":"4-541287ae0a14039fea89ac08fa5ec53d","name":"@cnpmcore/test-sync-package-has-two-versions","dist-tags":{"latest":"2.0.0","next":"2.0.0"},"versions":{"1.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"1.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@1.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-WR0T96H8t7ss1FK8GWPPblx+usbjU4bNGRjMHS9t/oVA5DgJDxitydPSFPeIUtXciyekI7R47do9Lc3GgC4P5A==","shasum":"2ddc6ee93b92be6d64139fb1a631d2610f43e946","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEYCIQDj5Ui2GU8nVmHFk0hCt/i3gPW9eQdOCZgKzpAlkvERwQIhAPZ0NCefLoEfOpnbdKAUr7Ng9Sy6FMnTsDxDaM2dQHNw"}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_1.0.0_1639442699824_0.6948988437963031"},"_hasShrinkwrap":false},"2.0.0":{"name":"@cnpmcore/test-sync-package-has-two-versions","version":"2.0.0","description":"cnpmcore local test package","main":"index.js","scripts":{"test":"echo \\"hello\\""},"author":"","license":"MIT","gitHead":"60cfb1cf401f87a60a1b0dfd7ee739f98ffd7847","_id":"@cnpmcore/test-sync-package-has-two-versions@2.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-qgHLQzXq+VN7q0JWibeBYrqb3Iajl4lpVuxlQstclRz4ejujfDFswBGSXmCv9FyIIdmSAe5bZo0oHQLsod3pAA==","shasum":"891eb8e08ceadbd86e75b6d66f31f7e5a28a8d68","tarball":"https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-2.0.0.tgz","fileCount":2,"unpackedSize":238,"signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCIAWVz7mIHF23Gq4a+Swsj2ZSdn87991HcE1+fQm8shNCAiByOIuhaZAbo9hct24qYf7FWqx6Lyluo+Rpnrn91//Ibg=="}]},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/test-sync-package-has-two-versions_2.0.0_1639442732240_0.33204392278137207"},"_hasShrinkwrap":false}},"time":{"created":"2021-12-14T00:44:59.775Z","1.0.0":"2021-12-14T00:44:59.940Z","modified":"2022-05-23T02:33:52.613Z","2.0.0":"2021-12-14T00:45:32.457Z"},"maintainers":[{"email":"killa07071201@gmail.com","name":"killagu"},{"email":"fengmk2@gmail.com","name":"fengmk2"}],"description":"cnpmcore local test package","license":"MIT","readme":"ERROR: No README data found!","readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/test-sync-package-has-two-versions/-/test-sync-package-has-two-versions-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = '@cnpmcore/test-sync-package-has-two-versions';
      await packageSyncerService.createTask(name, { specificVersions: [ '1.0.0', '9.99.9' ] });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      assert(log.includes('🚧 Some specific versions are not available: 👉 9.99.9'));
    });

    // 有任务积压，不一定能够同步完
    it.skip('should sync sourceRegistryIsCNpm = true && syncUpstreamFirst = true', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(', syncUpstream: true'));
      assert(log.includes('][UP] 🚧🚧🚧🚧🚧 Waiting sync "cnpmcore-test-sync-deprecated" task on https://r.cnpmjs.org 🚧'));
      assert(log.includes('][UP] 🟢🟢🟢🟢🟢 https://r.cnpmjs.org/cnpmcore-test-sync-deprecated 🟢'));
    });

    it('should not sync upstream when task queue too high', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      mock(app.config.cnpmcore, 'taskQueueHighWaterSize', 1);
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      await packageSyncerService.createTask(name + '-foo');
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(', syncUpstream: false'));
      assert(log.includes(', taskQueue: 1/1'));
      assert(!log.includes('][UP] 🚧🚧🚧🚧🚧 Waiting sync "cnpmcore-test-sync-deprecated" task on https://r.cnpmjs.org 🚧'));
    });

    it('should sync sourceRegistryIsCNpm = true && syncUpstreamFirst = false', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', false);
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('][UP] 🟢🟢🟢🟢🟢 https://r.cnpmjs.org/cnpmcore-test-sync-deprecated 🟢'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync sourceRegistryIsCNpm = true and mock createSyncTask error', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      mock.error(NPMRegistry.prototype, 'createSyncTask');
      const name = 'cnpmcore-test-sync-deprecated';
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
      assert(log.includes(`][UP] ❌ Sync ${name} fail, create sync task error:`));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync sourceRegistryIsCNpm = true and mock createSyncTask return missing logId', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      mock.data(NPMRegistry.prototype, 'createSyncTask', { data: { ok: true }, res: {} });
      const name = 'cnpmcore-test-sync-deprecated';
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
      assert(log.includes(`][UP] ❌ Sync ${name} fail, missing logId`));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync sourceRegistryIsCNpm = true and mock getSyncTask syncDone = false', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/sync', 'PUT', {
        data: {
          ok: true,
          logId: '633eea1359147b6066fae99f',
        },
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      mock(app.config.cnpmcore, 'sourceRegistrySyncTimeout', 300);
      let first = true;
      mock(NPMRegistry.prototype, 'getSyncTask', async () => {
        if (!first) {
          throw new Error('mock error');
        }
        first = false;
        return { data: { syncDone: false }, res: {}, status: 200 };
      });
      const name = 'cnpmcore-test-sync-deprecated';
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
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync sourceRegistryIsCNpm = true and mock sync upstream timeout', async () => {
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/sync', 'PUT', {
        data: {
          ok: true,
          logId: '633eea1359147b6066fae99f',
        },
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/sync/log/633eea1359147b6066fae99f', 'GET', {
        data: {
          ok: false,
          syncDone: false,
          log: '',
        },
        persist: true,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
        persist: false,
      });
      app.mockHttpclient('https://r.cnpmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
      mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
      mock(app.config.cnpmcore, 'syncUpstreamFirst', true);
      mock(app.config.cnpmcore, 'sourceRegistrySyncTimeout', 300);
      const name = 'cnpmcore-test-sync-deprecated';
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
      assert(log.includes(`][UP] ❌ Sync ${name} fail, timeout`));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should mock getFullManifests error', async () => {
      mock.error(NPMRegistry.prototype, 'getFullManifests');
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
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes(`❌ Synced ${name} fail, request manifests error`));
      // retry task
      const task2 = await packageSyncerService.findExecuteTask();
      assert(task2);
      assert(task2.id === task.id);
    });

    it('should mock getFullManifests invalid maintainers error', async () => {
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
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ invalid maintainers: '));
    });

    it('should try to use latest tag version maintainers instead', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated', 'GET', {
        data: '{"_id":"cnpmcore-test-sync-deprecated","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-sync-deprecated","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-sync-deprecated","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-sync-deprecated@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz","fileCount":1,"unpackedSize":250},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-deprecated/-/cnpmcore-test-sync-deprecated-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      // https://registry.npmjs.org/postman-jsdoc-theme
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('📖 Use the latest version(0.0.0) maintainers instead'));
      assert(log.includes('] 🔗'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should stop sync when upstream blocked', async () => {
      // sync first
      const name = 'cnpmcore-test-block-from-upstream';
      app.mockHttpclient(`https://registry.npmjs.org/${name}`, 'GET', {
        data: '{"_id":"cnpmcore-test-block-from-upstream","_rev":"2-bc8b9a2f6532d1bb3f94eaa4e82dbfe0","name":"cnpmcore-test-block-from-upstream","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"name":"cnpmcore-test-block-from-upstream","readme":"foo readme","version":"0.0.0","description":"","main":"index.js","scripts":{},"author":"","license":"ISC","dependencies":{},"_id":"cnpmcore-test-block-from-upstream@0.0.0","_nodeVersion":"16.13.1","_npmVersion":"8.1.2","dist":{"integrity":"sha512-ptVWDP7Z39wOBk5EBwi2x8/SKZblEsVcdL0jjIsaI2KdLwVpRRRnezJSKpUsXr982nGf0j7nh6RcHSg4Wlu3AA==","shasum":"c73398ff6db39d138a56c04c7a90f35b70d7b78f","tarball":"https://registry.npmjs.org/cnpmcore-test-block-from-upstream/-/cnpmcore-test-block-from-upstream-0.0.0.tgz","fileCount":1,"unpackedSize":250},"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"directories":{},"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_hasShrinkwrap":false,"deprecated":"only test for cnpmcore"}},"time":{"created":"2021-12-11T18:09:24.624Z","0.0.0":"2021-12-11T18:09:24.768Z","modified":"2022-04-12T06:56:55.617Z"},"maintainers":[],"license":"ISC","readme":{"foo":"mock readme is object"},"readmeFilename":""}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-block-from-upstream/-/cnpmcore-test-block-from-upstream-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      await packageSyncerService.createTask(name);
      let task = await packageSyncerService.findExecuteTask();
      await packageSyncerService.executeTask(task);

      const pkg = await packageRepository.findPackage('', name);
      const pkgVersion = await packageRepository.findPackageVersion(pkg!.packageId, '0.0.0');
      assert(pkg?.name === name);
      assert(pkgVersion);

      // mock unpublish
      app.mockHttpclient(`https://registry.npmjs.org/${name}`, 'GET', {
        data: `{"error":"[UNAVAILABLE_FOR_LEGAL_REASONS] ${name} was blocked, reason: foo (operator: cnpmcore_admin/61f154594ce7cf8f5827edf8)"}`,
        persist: false,
        status: 451,
      });

      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      await packageSyncerService.executeTask(task);

      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);

      assert(log.includes(`] 🟢 Package "${name}" was removed in remote registry`));
    });

    it('should stop sync by block list', async () => {
      const name = 'cnpmcore-test-sync-blocklist';
      mock(app.config.cnpmcore, 'syncPackageBlockList', [ name, 'foo' ]);
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ stop sync by block list: [\"cnpmcore-test-sync-blocklist\",\"foo\"]'));
    });

    it('should sync upper case "D" success', async () => {
      app.mockHttpclient('https://registry.npmjs.org/D', 'GET', {
        data: '{"_id":"D","_rev":"9-83b2794fe968ab4d4dc5c72475afe1ed","name":"D","dist-tags":{"latest":"1.0.0"},"versions":{"0.0.1":{"name":"D","version":"0.0.1","description":"","main":"index.js","scripts":{"test":"echo \\"Error: no test specified\\" && exit 1"},"author":{"name":"zhengzk"},"license":"MIT","_id":"D@0.0.1","_shasum":"292f54dbd43f36e4853f6a09e77617c23c46228b","_from":".","_npmVersion":"2.15.1","_nodeVersion":"4.4.3","_npmUser":{"name":"zhengzk","email":"studyc@163.com"},"dist":{"shasum":"292f54dbd43f36e4853f6a09e77617c23c46228b","tarball":"https://registry.npmjs.org/D/-/D-0.0.1.tgz","integrity":"sha512-8LsXYQFO1mko5MQ7qh72xjbCtB6PiNFC+q97eEZ85vrGL5HwMb27CuhWJKbcN6LrL8/zEwQYolHSV/jMyZ4zYg==","signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEUCICqSbDSXvMFKDfikUr0uttJJGWnrYFHfbOab67m0qOtZAiEAimvItLP13BkE5ex448H7eRtfAzOfQ1lCqNd1ygihn7A="}]},"maintainers":[{"name":"zhengzk","email":"studyc@163.com"}],"_npmOperationalInternal":{"host":"packages-16-east.internal.npmjs.com","tmp":"tmp/D-0.0.1.tgz_1464672428722_0.6098439614288509"},"deprecated":"Package no longer supported. Contact support@npmjs.com for more info.","directories":{}},"1.0.0":{"name":"D","version":"1.0.0","description":"This package is no longer supported and has been deprecated. To avoid malicious use, npm is hanging on to the package name.","main":"index.js","scripts":{"test":"echo \\"Error: no test specified\\" && exit 1"},"repository":{"type":"git","url":"git+https://github.com/npm/deprecate-holder.git"},"author":"","license":"ISC","bugs":{"url":"https://github.com/npm/deprecate-holder/issues"},"homepage":"https://github.com/npm/deprecate-holder#readme","_id":"D@1.0.0","_npmVersion":"5.3.0","_nodeVersion":"8.2.1","_npmUser":{"name":"lisayu","email":"lisa@npmjs.com"},"dist":{"integrity":"sha512-nQvrCBu7K2pSSEtIM0EEF03FVjcczCXInMt3moLNFbjlWx6bZrX72uT6/1uAXDbnzGUAx9gTyDiQ+vrFi663oA==","shasum":"c348a4e034f72847be51206fc530fc089e9cc2a9","tarball":"https://registry.npmjs.org/D/-/D-1.0.0.tgz","signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEQCICZ8ljQHo15g72enGrhsxRggI5u1HmTzqaSwDdKK7pWMAiBophHVaH8mkvZjw45S2C65XmgOEqaKxKqv59mniAjosw=="}]},"maintainers":[{"email":"lisa@npmjs.com","name":"lisayu"}],"_npmOperationalInternal":{"host":"s3://npm-registry-packages","tmp":"tmp/D-1.0.0.tgz_1502418423486_0.45665086852386594"},"deprecated":"Package no longer supported. Contact support@npmjs.com for more info.","directories":{}}},"readme":"# Deprecated Package\\n\\nThis package is no longer supported and has been deprecated. To avoid malicious use, npm is hanging on to the package name.\\n\\nPlease contact support@npmjs.com if you have questions about this package. \\n","maintainers":[{"email":"npm@npmjs.com","name":"npm"}],"time":{"modified":"2022-06-13T02:13:35.883Z","created":"2016-05-31T05:27:12.203Z","0.0.1":"2016-05-31T05:27:12.203Z","1.0.0":"2017-08-11T02:27:03.593Z"},"license":"ISC","readmeFilename":"README.md","description":"This package is no longer supported and has been deprecated. To avoid malicious use, npm is hanging on to the package name.","homepage":"https://github.com/npm/deprecate-holder#readme","repository":{"type":"git","url":"git+https://github.com/npm/deprecate-holder.git"},"bugs":{"url":"https://github.com/npm/deprecate-holder/issues"},"users":{"subbarao":true}}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/D/-/D-0.0.1.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/D/-/D-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'D';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚧🚧🚧🚧🚧 Syncing from https://registry.npmjs.org/D, '));
      assert(log.includes('🔗'));
      const res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.name === name);
      // assert(data.dist === name);
      assert(data.versions[data['dist-tags'].latest].dist.tarball.includes('/D/-/D-'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync upper case "Buffer" success', async () => {
      app.mockHttpclient('https://registry.npmjs.org/Buffer', 'GET', {
        data: '{"_id":"Buffer","_rev":"5-b918bb11193c501a415c51047d6d68c7","name":"Buffer","description":"API-compatible Node.JS Buffer for Ender.js (browser)","dist-tags":{"latest":"0.0.0"},"versions":{"0.0.0":{"author":{"name":"AJ ONeal","email":"coolaj86@gmail.com","url":"http://coolaj86.info"},"name":"Buffer","description":"API-compatible Node.JS Buffer for Ender.js (browser)","version":"0.0.0","repository":{"type":"git","url":"git://github.com/coolaj86/browser-buffer.git"},"main":"index.js","engines":{"node":">= 0.2.0"},"dependencies":{},"devDependencies":{},"_npmJsonOpts":{"file":"/Users/coolaj86/.npm/Buffer/0.0.0/package/package.json","wscript":false,"contributors":false,"serverjs":false},"_id":"Buffer@0.0.0","_engineSupported":true,"_npmVersion":"1.0.15","_nodeVersion":"v0.4.8","_defaultsLoaded":true,"dist":{"shasum":"82cf8e986a2109ff6d1d6f1c436e47d07127aea4","tarball":"https://registry.npmjs.org/Buffer/-/Buffer-0.0.0.tgz","integrity":"sha512-+zdncl8lI5TCkARStn9F1BwcuJYofYmD0oEHe5FNfCvGfeDJwf6+dSikCdQN6BMXXmHMhNNUagBN367WST1AIQ==","signatures":[{"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","sig":"MEUCIQDbPvXxxdsc/1aMyduDYXMbRVTFU71ajZ5BztZ3S07ofQIgBy/kpAuBDMIhlfOQW2l2XIq8eMs6BNqjEPXo3CJ5WrE="}]},"scripts":{},"maintainers":[{"name":"coolaj86","email":"coolaj86@gmail.com"}]}},"maintainers":[{"name":"coolaj86","email":"coolaj86@gmail.com"}],"time":{"modified":"2022-06-13T02:13:16.055Z","created":"2011-08-01T20:40:41.355Z","0.0.0":"2011-08-01T20:40:41.710Z"},"author":{"name":"AJ ONeal","email":"coolaj86@gmail.com","url":"http://coolaj86.info"},"repository":{"type":"git","url":"git://github.com/coolaj86/browser-buffer.git"}}',
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/Buffer/-/Buffer-0.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'Buffer';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🚧🚧🚧🚧🚧 Syncing from https://registry.npmjs.org/Buffer, '));
      assert(log.includes('🔗'));
      const res = await app.httpRequest()
        .get(`/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.name === name);
      assert(data.versions[data['dist-tags'].latest].dist.tarball.includes('/Buffer/-/Buffer-'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should mock security holding package', async () => {
      app.mockHttpclient('https://registry.npmjs.org/cnpmcore-test-sync-security-holding-package', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/security-holding-package.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/webpack.js.org/-/webpack.js.org-0.0.1-security.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const name = 'cnpmcore-test-sync-security-holding-package';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`] 🟢 Package "${name}" was removed in remote registry`));
    });

    it('should mock getFullManifests missing tarball error and downloadTarball error', async () => {
      app.mockHttpclient('http://foo.com/a.tgz', 'GET', {
        status: 500,
        persist: false,
        repeats: 3,
      });
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
              dist: { tarball: 'http://foo.com/a.tgz' },
            },
          },
        },
        res: {},
        headers: {},
      });
      const name = 'cnpmcore-test-sync-deprecated';
      await packageSyncerService.createTask(name);
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('Synced version 1.0.0 fail, missing tarball, dist: '));
      assert(log.includes('❌ All versions sync fail, package not exists'));
      assert(log.includes('Synced version 2.0.0 fail, download tarball error'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should mock downloadTarball status !== 200', async () => {
      app.mockHttpclient('http://foo.com/a.tgz', 'GET', {
        status: 500,
        persist: false,
        repeats: 3,
      });
      mock.data(NPMRegistry.prototype, 'getFullManifests', {
        data: {
          maintainers: [{ name: 'fengmk2', email: 'fengmk2@gmai.com' }],
          versions: {
            '2.0.0': {
              version: '2.0.0',
              dist: { tarball: 'http://foo.com/a.tgz' },
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
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes(`❌❌❌❌❌ ${name} ❌❌❌❌❌`));
      assert(log.includes('❌ All versions sync fail, package not exists'));
      assert(log.includes('Synced version 2.0.0 fail, download tarball error: DownloadStatusInvalidError: Download http://foo.com/a.tgz status(500) invalid'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync mk2test-module-cnpmsync with different metas', async () => {
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/mk2test-module-cnpmsync.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync/-/mk2test-module-cnpmsync-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync/-/mk2test-module-cnpmsync-3.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });

      const name = 'mk2test-module-cnpmsync';
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      await TestUtil.createPackage({ name, version: '2.0.0', isPrivate: false });
      await packageSyncerService.createTask(name, { tips: 'sync test tips here' });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('Synced version 2.0.0 success, different meta: {"peerDependenciesMeta":{"bufferutil":{"optional":true},"utf-8-validate":{"optional":true}},"os":["linux"],"cpu":["x64"],"_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"}}'));
      assert(log.includes('Z] 👉👉👉👉👉 Tips: sync test tips here 👈👈👈👈👈'));
      assert(log.includes(', skipDependencies: false'));
      let manifests = await packageManagerService.listPackageFullManifests('', name);
      assert(manifests.data?.versions['2.0.0']);
      assert.equal(manifests.data.versions['2.0.0'].peerDependenciesMeta?.bufferutil.optional, true);
      assert.equal(manifests.data.versions['2.0.0'].os?.[0], 'linux');
      assert.equal(manifests.data.versions['2.0.0'].cpu?.[0], 'x64');
      // publishTime
      assert.equal(manifests.data.time['1.0.0'], '2021-09-27T08:10:48.747Z');
      let abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      // console.log(JSON.stringify(abbreviatedManifests.data, null, 2));
      assert(abbreviatedManifests.data?.versions['2.0.0']);
      assert.equal(abbreviatedManifests.data!.versions['2.0.0'].peerDependenciesMeta?.bufferutil.optional, true);
      assert.equal(abbreviatedManifests.data!.versions['2.0.0'].os?.[0], 'linux');
      assert.equal(abbreviatedManifests.data!.versions['2.0.0'].cpu?.[0], 'x64');
      app.mockAgent().assertNoPendingInterceptors();

      // again should skip sync different metas
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/mk2test-module-cnpmsync.json'),
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('🟢 Synced version 2.0.0 success, different meta:'));
      app.mockAgent().assertNoPendingInterceptors();

      // should delete readme
      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/mk2test-module-cnpmsync.json'),
        persist: false,
      });
      manifests.data.versions['2.0.0'].readme = 'mock version readme content';
      mock.data(PackageManagerService.prototype, 'listPackageFullManifests', manifests);
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🟢 Synced version 2.0.0 success, different meta: {}, delete exists readme'));
      app.mockAgent().assertNoPendingInterceptors();
      await mock.restore();
      manifests = await packageManagerService.listPackageFullManifests('', name);
      assert(manifests.data?.versions['2.0.0']);
      assert(manifests.data.versions['2.0.0'].readme === undefined);

      // should sync missing cpu on abbreviated manifests
      const pkg = await packageRepository.findPackage('', name);
      const pkgVersion = await packageRepository.findPackageVersion(pkg!.packageId, '2.0.0');
      assert(pkgVersion);
      await packageManagerService.savePackageVersionManifest(pkgVersion, {}, { cpu: undefined, libc: [ 'glibc' ] });
      await packageManagerService.refreshPackageChangeVersionsToDists(pkg!, [ '2.0.0' ]);
      abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert(!abbreviatedManifests.data!.versions['2.0.0'].cpu);
      assert.deepStrictEqual(abbreviatedManifests.data!.versions['2.0.0'].libc, [ 'glibc' ]);

      app.mockHttpclient('https://registry.npmjs.org/mk2test-module-cnpmsync', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/mk2test-module-cnpmsync.json'),
        persist: false,
      });
      await packageSyncerService.createTask(name);
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('🟢 Synced version 2.0.0 success, different meta: {"cpu":["x64"]}'));
      app.mockAgent().assertNoPendingInterceptors();
      await mock.restore();
      abbreviatedManifests = await packageManagerService.listPackageAbbreviatedManifests('', name);
      assert(abbreviatedManifests.data?.versions['2.0.0']);
      assert.equal(abbreviatedManifests.data.versions['2.0.0'].cpu?.[0], 'x64');
      assert(!abbreviatedManifests.data!.versions['2.0.0'].libc);
    });

    it('should sync download data work on enableSyncDownloadData = true', async () => {
      mock(app.config.cnpmcore, 'syncDownloadDataSourceRegistry', 'https://rold.cnpmjs.org');
      mock(app.config.cnpmcore, 'enableSyncDownloadData', true);
      mock(app.config.cnpmcore, 'syncDownloadDataMaxDate', '2021-12-28');
      app.mockHttpclient('https://registry.npmjs.org/pedding', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/pedding.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      const response = await TestUtil.readJSONFile(TestUtil.getFixtures('downloads.json'));
      app.mockHttpclient('https://rold.cnpmjs.org/downloads/range/2011-01-01:2021-12-28/pedding', 'GET', {
        data: response,
        status: 200,
      });

      const name = 'pedding';
      await packageSyncerService.createTask(name, { syncDownloadData: true });
      let task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      let stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      let log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('][DownloadData] 🟢 202101: 31 days'));
      assert(log.includes('][DownloadData] 🟢🟢🟢🟢🟢'));
      assert(log.includes('] 🟢🟢🟢🟢🟢'));

      let res = await app.httpRequest()
        .get(`/downloads/range/2020-12-28:2021-12-28/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      let data = res.body;
      assert(data.downloads.length > 0);
      assert(Object.keys(data.versions).length === 0);
      // console.log('%j', data);

      // again should sync download data only
      await packageSyncerService.createTask(name, { syncDownloadData: true });
      task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('][DownloadData] 🟢 202110: 31 days'));
      assert(log.includes('][DownloadData] 🟢🟢🟢🟢🟢'));
      assert(log.includes(`] 🟢🟢🟢🟢🟢 Sync "${name}" download data success 🟢🟢🟢🟢🟢`));

      res = await app.httpRequest()
        .get(`/downloads/range/2020-12-28:2021-12-28/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert(data.downloads.length > 0);
      assert(Object.keys(data.versions).length === 0);
      // console.log('%j', data);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should ignore sync download data work on enableSyncDownloadData = false', async () => {
      app.mockHttpclient('https://registry.npmjs.org/pedding', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/pedding.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'enableSyncDownloadData', false);
      const name = 'pedding';
      await packageSyncerService.createTask(name, { syncDownloadData: true });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(!log.includes('][DownloadData] 🟢 202111: 10 days'));
      assert(!log.includes('][DownloadData] 🟢🟢🟢🟢🟢'));

      const res = await app.httpRequest()
        .get(`/downloads/range/2020-12-28:2021-12-28/${name}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.downloads.length === 0);
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should sync download data and mock getDownloadRanges error', async () => {
      app.mockHttpclient('https://registry.npmjs.org/pedding', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/pedding.json'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.0.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/pedding/-/pedding-1.1.0.tgz', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
        persist: false,
      });
      mock(app.config.cnpmcore, 'syncDownloadDataSourceRegistry', 'https://rold.cnpmjs.org');
      mock(app.config.cnpmcore, 'enableSyncDownloadData', true);
      mock(app.config.cnpmcore, 'syncDownloadDataMaxDate', '2021-12-28');
      mock.error(NPMRegistry.prototype, 'getDownloadRanges');

      const name = 'pedding';
      await packageSyncerService.createTask(name, { syncDownloadData: true });
      const task = await packageSyncerService.findExecuteTask();
      assert(task);
      assert.equal(task.targetName, name);
      await packageSyncerService.executeTask(task);
      const stream = await packageSyncerService.findTaskLog(task);
      assert(stream);
      const log = await TestUtil.readStreamToLog(stream);
      // console.log(log);
      assert(log.includes('][DownloadData] ❌ Get download data error: '));
      assert(log.includes('][DownloadData] ❌❌❌❌❌ 🚮 give up 🚮 ❌❌❌❌❌'));
      app.mockAgent().assertNoPendingInterceptors();
    });

    describe('should sync from spec registry', async () => {
      let registry: Registry;
      beforeEach(async () => {
        registry = await registryManagerService.createRegistry({
          name: 'cnpm',
          changeStream: 'https://replicate.npmjs.com/_changes',
          host: 'https://custom.npmjs.com',
          userPrefix: 'cnpm:',
          type: RegistryType.Npm,
        });
      });

      it('should ignore syncUpstreamFirst', async () => {
        await scopeManagerService.createScope({
          name: '@dnpm',
          registryId: registry.registryId,
        });
        app.mockHttpclient('https://custom.npmjs.com/@dnpm/banana', 'GET', {
          data: await TestUtil.readFixturesFile('r.cnpmjs.org/cnpmcore-test-sync-deprecated.json'),
          persist: false,
        });
        app.mockHttpclient('https://custom.npmjs.com/@dnpm/banana/-/banana-0.0.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
          persist: false,
        });
        mock(app.config.cnpmcore, 'sourceRegistry', 'https://r.cnpmjs.org');
        mock(app.config.cnpmcore, 'sourceRegistryIsCNpm', true);
        mock(app.config.cnpmcore, 'syncUpstreamFirst', true);

        const name = '@dnpm/banana';
        await packageSyncerService.createTask(name);
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        assert.equal(task.targetName, name);
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        // console.log(log);
        assert(log.includes('syncUpstream: false'));

      });

      it('should sync from target registry & default registry', async () => {
        await packageSyncerService.createTask('cnpm-pkg', { registryId: registry.registryId });
        await packageSyncerService.createTask('npm-pkg');

        // custom registry
        app.mockHttpclient('https://custom.npmjs.com/cnpm-pkg', 'GET', {
          status: 500,
          data: 'mock custom.npmjs.com error',
          persist: false,
          repeats: 3,
        });
        let task = await packageSyncerService.findExecuteTask();
        await packageSyncerService.executeTask(task);
        let stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        let log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('Syncing from https://custom.npmjs.com/cnpm-pkg'));

        // default registry
        app.mockHttpclient('https://default.npmjs.org/npm-pkg', 'GET', {
          status: 500,
          data: 'mock default.npmjs.org error',
          persist: false,
          repeats: 3,
        });
        task = await packageSyncerService.findExecuteTask();
        mock(app.config.cnpmcore, 'sourceRegistry', 'https://default.npmjs.org');
        await packageSyncerService.executeTask(task);
        stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('Syncing from https://default.npmjs.org/npm-pkg'));
        app.mockAgent().assertNoPendingInterceptors();
      });

      it('should sync from default registry when pkg.registryId is undefined', async () => {
        const pkgName = '@cnpmcore/sync_not_match_registry_name';
        await TestUtil.createPackage({
          name: pkgName,
          registryId: undefined,
          isPrivate: false,
        }, {
          name: 'mock_username',
        });

        // default registry
        app.mockHttpclient('https://registry.npmjs.org/@cnpmcore/sync_not_match_registry_name', 'GET', {
          status: 500,
          data: 'mock default.npmjs.org error',
          persist: false,
          repeats: 3,
        });

        await taskService.createTask(TaskEntity.createSyncPackage(pkgName, {}), true);
        const task = await packageSyncerService.findExecuteTask();
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('Syncing from https://registry.npmjs.org/@cnpmcore/sync_not_match_registry_name'));

      });

      it('should sync from target registry when pkg.registryId is undefined', async () => {
        const pkgName = '@cnpm/banana';
        await TestUtil.createPackage({
          name: pkgName,
          isPrivate: false,
        }, {
          name: 'mock_username',
        });
        await packageSyncerService.createTask(pkgName);
        const task = await packageSyncerService.findExecuteTask();

        // create custom scope
        await scopeManagerService.createScope({
          name: '@cnpm',
          registryId: registry.registryId,
        });

        app.mockHttpclient('https://custom.npmjs.com/@cnpm/banana', 'GET', {
          status: 500,
          data: 'mock error',
          persist: false,
          repeats: 3,
        });
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('Syncing from https://custom.npmjs.com/@cnpm/banana'));

        const pkg = await packageRepository.findPackage('@cnpm', 'banana');
        assert(pkg!.registryId === registry.registryId);
      });

      it('should sync from target registry when pkg not exists', async () => {
        const pkgName = '@cnpm/banana';
        await packageSyncerService.createTask(pkgName);
        const task = await packageSyncerService.findExecuteTask();

        // create custom scope
        await scopeManagerService.createScope({
          name: '@cnpm',
          registryId: registry.registryId,
        });

        app.mockHttpclient('https://custom.npmjs.com/@cnpm/banana', 'GET', {
          status: 500,
          data: 'mock error',
          persist: false,
          repeats: 3,
        });
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('Syncing from https://custom.npmjs.com/@cnpm/banana'));
      });


      it('should not sync from target registry if not match', async () => {
        const pkgName = '@cnpmcore/sync_not_match_registry_name';
        await TestUtil.createPackage({
          name: pkgName,
          registryId: 'mock_registry_id',
          isPrivate: false,
        }, {
          name: 'mock_username',
        });
        await taskService.createTask(TaskEntity.createSyncPackage(pkgName, {
          registryId: registry.registryId,
        }), true);
        const task = await packageSyncerService.findExecuteTask();
        await packageSyncerService.executeTask(task);
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log.includes('skip sync'));
      });
    });

    describe('syncDeleteMode = ignore', async () => {

      // already synced pkg
      beforeEach(async () => {
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
          persist: false,
          repeats: 1,
        });
        app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
          persist: false,
        });
        app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz'),
          persist: false,
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        assert(!await TaskModel.findOne({ taskId: task.taskId }));
        assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));

      });

      it('should ignore when upstream is removed', async () => {
        // removed in remote
        mock(app.config.cnpmcore, 'syncDeleteMode', 'ignore');
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/security-holding-package.json'),
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        assert(!await TaskModel.findOne({ taskId: task.taskId }));
        assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log);
        // console.log(log);
        const model = await PackageModel.findOne({ scope: '', name: 'foobar' });
        assert(model);
        const versions = await PackageVersion.find({ packageId: model.packageId });
        assert.equal(model!.isPrivate, false);
        assert(versions.length === 2);

      });

      it('should block when upstream is removed', async () => {
        // removed in remote
        mock(app.config.cnpmcore, 'syncDeleteMode', 'block');
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/security-holding-package.json'),
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        const task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        assert(!await TaskModel.findOne({ taskId: task.taskId }));
        assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log);
        // console.log(log);
        const model = await PackageModel.findOne({ scope: '', name: 'foobar' });
        assert(model);
        const versions = await PackageVersion.find({ packageId: model.packageId });
        assert.equal(model!.isPrivate, false);
        assert(versions.length === 2);

        const manifests = await packageManagerService.listPackageFullManifests('', 'foobar');
        assert(manifests.blockReason === 'Removed in remote registry');
        assert(manifests.data);
        assert(manifests.data.block === 'Removed in remote registry');
        const pkg = await packageRepository.findPackage('', 'foobar');
        assert(pkg);

        await app.httpRequest()
          .get(`/${pkg.name}`)
          .expect(451);

        // could resotre
        await packageManagerService.unblockPackage(pkg);

        await app.httpRequest()
          .get(`/${pkg.name}`)
          .expect(200);

      });

      it('unpublish package idempotent', async () => {
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/security-holding-package.json'),
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        let task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        assert(!await TaskModel.findOne({ taskId: task.taskId }));
        assert(await HistoryTaskModel.findOne({ taskId: task.taskId }));
        const stream = await packageSyncerService.findTaskLog(task);
        assert(stream);
        const log = await TestUtil.readStreamToLog(stream);
        assert(log);
        // console.log(log);
        const model = await PackageModel.findOne({ scope: '', name: 'foobar' });
        assert(model);
        const versions = await PackageVersion.find({ packageId: model.packageId });
        assert(versions.length === 0);

        // resync
        app.mockLog();
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        task = await packageSyncerService.findExecuteTask();
        await packageSyncerService.executeTask(task);
        assert(task);
        const pkg = await packageRepository.findPackage('', 'foobar');
        app.expectLog(`[packageManagerService.unpublishPackage:skip] ${pkg?.packageId} already unpublished`);

      });

      it('should resync history version if forceSyncHistory is true', async () => {
        const manifest = JSON.parse((await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json')).toString());
        manifest.versions['1.0.0']._npmUser = { name: 'apple', email: 'apple@cnpmjs.org' };
        manifest.maintainers = [ ...manifest.maintainers, { name: 'apple', email: 'apple@cnpmjs.org' }];
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: manifest,
          persist: false,
          repeats: 1,
        });
        app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz'),
          persist: false,
          repeats: 2,
        });
        app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.1.0.tgz', 'GET', {
          data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.1.0.tgz'),
          persist: false,
          repeats: 2,
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        let task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);

        // should sync publisher
        const syncInfo = await packageManagerService.listPackageFullManifests('', 'foobar');
        assert.equal(syncInfo.data?.versions['1.0.0']?._npmUser?.name, 'apple');

        // resync
        manifest.versions['1.0.0']._npmUser = { name: 'banana', email: 'banana@cnpmjs.org' };
        app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
          data: manifest,
          persist: false,
          repeats: 1,
        });
        await packageSyncerService.createTask('foobar', { skipDependencies: true });
        task = await packageSyncerService.findExecuteTask();
        assert(task);
        await packageSyncerService.executeTask(task);
        const stream2 = await packageSyncerService.findTaskLog(task);
        assert(stream2);
        const log2 = await TestUtil.readStreamToLog(stream2);
        // console.log(log2);
        assert(/different meta: {"_npmUser":{"name":"banana","email":"banana@cnpmjs.org"}}/.test(log2));
      });
    });
  });
});
