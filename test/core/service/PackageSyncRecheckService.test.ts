import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { NPMRegistry } from '../../../app/common/adapter/NPMRegistry.ts';
import { TaskState, TaskType } from '../../../app/common/enum/Task.ts';
import type { Registry } from '../../../app/core/entity/Registry.ts';
import { Task } from '../../../app/core/entity/Task.ts';
import { PackageManagerService } from '../../../app/core/service/PackageManagerService.ts';
import { PackageSyncerService } from '../../../app/core/service/PackageSyncerService.ts';
import { PackageSyncRecheckService } from '../../../app/core/service/PackageSyncRecheckService.ts';
import { RegistryManagerService } from '../../../app/core/service/RegistryManagerService.ts';
import { TaskService } from '../../../app/core/service/TaskService.ts';
import { SyncRecheckQueue } from '../../../app/infra/SyncRecheckQueue.ts';
import { PackageVersionDownloadRepository } from '../../../app/repository/PackageVersionDownloadRepository.ts';
import { TaskRepository } from '../../../app/repository/TaskRepository.ts';
import { TestUtil } from '../../TestUtil.ts';

describe('test/core/service/PackageSyncRecheckService.test.ts', () => {
  const name = 'cnpmcore-test-sync-deprecated';
  let service: PackageSyncRecheckService;
  let syncer: PackageSyncerService;
  let tasks: TaskService;
  let queue: SyncRecheckQueue;
  let manager: PackageManagerService;
  let registry: Registry;
  let now: number;
  beforeEach(async () => {
    now = Date.now();
    mock(Date, 'now', () => now);
    mock(app.config.cnpmcore, 'syncRecheck', {
      ...app.config.cnpmcore.syncRecheck,
      enabled: true,
      delays: [1000, 2000, 3000],
    });
    mock(PackageVersionDownloadRepository.prototype, 'getWeeklyDownloads', async (fullname: string) =>
      fullname === name ? 10_000 : 0,
    );
    service = await app.getEggObject(PackageSyncRecheckService);
    syncer = await app.getEggObject(PackageSyncerService);
    tasks = await app.getEggObject(TaskService);
    queue = await app.getEggObject(SyncRecheckQueue);
    manager = await app.getEggObject(PackageManagerService);
    registry = await (await app.getEggObject(RegistryManagerService)).ensureDefaultRegistry();
  });

  async function tick(ms = 1000) {
    now += ms;
    await app.redis.del('CNPMCORE_SYNC_RECHECK:dispatch');
    await service.dispatch();
  }

  async function executeNext() {
    const task = await syncer.findExecuteTask();
    assert.ok(task);
    await syncer.executeTask(task);
    return task;
  }

  for (const packument of [false, true]) {
    for (const unavailableTarball of [false, true]) {
      it(`automatically catches up after ${unavailableTarball ? 'a tarball failure' : 'an unchanged snapshot'} (packument=${packument})`, async () => {
        mock(app.config.cnpmcore.experimental, 'syncPackageWithPackument', packument);
        const data = JSON.parse((await TestUtil.readFixturesFile(`registry.npmjs.org/${name}.json`)).toString());
        const tarball = await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz');
        mock(NPMRegistry.prototype, 'getFullManifestsBuffer', async () => ({
          status: 200,
          data: Buffer.from(JSON.stringify(data)),
          headers: {},
          res: {},
          url: registry.host,
        }));
        app.mockHttpclient(data.versions['0.0.0'].dist.tarball, 'GET', { data: tarball, persist: false });
        const initial = await syncer.createTask(name, { registryId: registry.registryId, skipDependencies: true });
        await executeNext();
        await service.record(registry, { fullname: name, seq: '1' }, initial);

        const newVersion = structuredClone(data.versions['0.0.0']);
        newVersion.version = '0.0.1';
        newVersion.dist.tarball = `https://registry.npmjs.org/${name}/-/new.tgz`;
        const exposeVersion = () => {
          data.versions['0.0.1'] = newVersion;
          data['dist-tags'].latest = '0.0.1';
          data.time['0.0.1'] = new Date().toISOString();
        };
        if (unavailableTarball) {
          exposeVersion();
          app.mockHttpclient(newVersion.dist.tarball, 'GET', {
            status: 404,
            data: 'pending',
            persist: false,
          });
        }
        await tick();
        const first = await executeNext();
        assert.equal(first.data.maxAttempts, 1);
        let result = await manager.listPackageFullManifests('', name);
        assert.equal(result.data?.versions?.['0.0.1'], undefined);
        assert.equal((await queue.get(queue.key(registry.registryId, name)))?.pending, true);

        // The version becomes available with no additional changes notification.
        exposeVersion();
        app.mockHttpclient(newVersion.dist.tarball, 'GET', { data: tarball, persist: false });
        await tick();
        await executeNext();
        result = await manager.listPackageFullManifests('', name);
        assert.ok(result.data?.versions?.['0.0.1']);
        assert.equal(result.data['dist-tags'].latest, '0.0.1');
      });
    }
  }

  it('schedules no extra work for a cold package or when disabled', async () => {
    const task = await syncer.createTask('cold');
    await service.record(registry, { fullname: 'cold', seq: '1' }, task);
    assert.equal(await queue.get(queue.key(registry.registryId, 'cold')), null);
    mock(app.config.cnpmcore.syncRecheck, 'enabled', false);
    await service.record(registry, { fullname: name, seq: '2' }, task);
    assert.equal(await queue.get(queue.key(registry.registryId, name)), null);
  });

  it('waits for an active task, then checks again without losing a change received during processing', async () => {
    const initial = await syncer.createTask(name);
    const running = await syncer.findExecuteTask();
    assert.ok(running);
    await service.record(registry, { fullname: name, seq: '1', version: '0.0.1' }, initial);
    await tick();
    assert.deepEqual((await queue.get(queue.key(registry.registryId, name)))?.attempts, []);
    await tasks.finishTask(running, TaskState.Fail);
    await tick(30_000);
    const followup = await syncer.findExecuteTask();
    assert.ok(followup);
    assert.notEqual(followup.taskId, initial.taskId);
    assert.equal(followup.data.maxAttempts, 1);
  });

  it('stops pending checks when the stored weekly downloads drop below the threshold', async () => {
    const initial = await syncer.createTask(name);
    await tasks.finishTask(initial, TaskState.Success);
    await service.record(registry, { fullname: name, seq: '1' }, initial);
    mock.data(PackageVersionDownloadRepository.prototype, 'getWeeklyDownloads', 9999);
    await tick();
    const state = await queue.get(queue.key(registry.registryId, name));
    assert.ok(state);
    assert.equal(state.pending, false);
    assert.deepEqual(state.attempts, []);
    assert.equal(await syncer.findExecuteTask(), null);
  });

  it('stops early only when explicit targets are present after a successful sync', async () => {
    const task = await syncer.createTask(name);
    await tasks.finishTask(task, TaskState.Success);
    mock.data(manager, 'listPackageFullManifests', { data: { versions: { '0.0.1': {} } }, blockReason: '' });
    await service.record(registry, { fullname: name, seq: '1', version: '0.0.1' }, task);
    await tick();
    assert.equal((await queue.get(queue.key(registry.registryId, name)))?.pending, false);
    assert.equal(await syncer.findExecuteTask(), null);
  });

  it('recovers an already completed reserved task without another enqueue', async () => {
    const initial = await syncer.createTask(name);
    await tasks.finishTask(initial, TaskState.Success);
    await service.record(registry, { fullname: name, seq: '1' }, initial);
    now += 1000;
    const claim = await queue.claim();
    assert.ok(claim);
    const reserved = await queue.reserve(claim.key, claim.state.lease!);
    assert.ok(reserved?.dispatchTaskId);
    const task = await syncer.createTask(name, { taskId: reserved.dispatchTaskId, maxAttempts: 1 });
    assert.equal(task.taskId, reserved.dispatchTaskId);
    await tasks.finishTask(task, TaskState.Success);
    await tick(60_000);
    const state = await queue.get(claim.key);
    assert.equal(state?.step, 1);
    assert.equal(state?.attempts.length, 1);
    assert.equal(await syncer.findExecuteTask(), null);
  });

  it('does not enter the immediate retry loop after a recheck fetch fails', async () => {
    const task = await syncer.createTask(name, { maxAttempts: 1 });
    mock.error(NPMRegistry.prototype, 'getFullManifestsBuffer');
    await executeNext();
    assert.equal((await tasks.findTask(task.taskId))?.state, TaskState.Fail);
    assert.equal(await tasks.getTaskQueueLength(TaskType.SyncPackage), 0);
  });

  it('restores the queue entry if dispatch stopped after the database insert', async () => {
    const initial = await syncer.createTask(name);
    const running = await syncer.findExecuteTask();
    assert.ok(running);
    await tasks.finishTask(running, TaskState.Success);
    await service.record(registry, { fullname: name, seq: '1' }, initial);
    now += 1000;
    const claim = await queue.claim();
    assert.ok(claim);
    const reserved = await queue.reserve(claim.key, claim.state.lease!);
    assert.ok(reserved?.dispatchTaskId);
    const task = Task.createSyncPackage(name, { taskId: reserved.dispatchTaskId, maxAttempts: 1 });
    await (await app.getEggObject(TaskRepository)).saveTask(task);
    assert.equal(await tasks.getTaskQueueLength(TaskType.SyncPackage), 0);
    await tick(60_000);
    assert.equal((await syncer.findExecuteTask())?.taskId, reserved.dispatchTaskId);
    assert.equal((await queue.get(claim.key))?.attempts.length, 1);
  });

  it('leaves due work pending while the ordinary queue is above its high water mark', async () => {
    const task = await syncer.createTask(name);
    await service.record(registry, { fullname: name, seq: '1' }, task);
    mock(app.config.cnpmcore, 'taskQueueHighWaterSize', 1);
    await tick();
    assert.deepEqual((await queue.get(queue.key(registry.registryId, name)))?.attempts, []);
  });
});
