import { AccessLevel, Inject, SingletonProto } from 'egg';

import { AbstractService } from '../../common/AbstractService.ts';
import type { ChangesStreamChange } from '../../common/adapter/changesStream/AbstractChangesStream.ts';
import { TaskState, TaskType } from '../../common/enum/Task.ts';
import { getScopeAndName } from '../../common/PackageUtil.ts';
import type { SyncRecheckState } from '../../common/SyncRecheck.ts';
import type { SyncRecheckQueue } from '../../infra/SyncRecheckQueue.ts';
import type { PackageRepository } from '../../repository/PackageRepository.ts';
import type { TaskRepository } from '../../repository/TaskRepository.ts';
import type { Registry } from '../entity/Registry.ts';
import type { Task } from '../entity/Task.ts';
import type { PackageManagerService } from './PackageManagerService.ts';
import type { PackagePopularityService } from './PackagePopularityService.ts';
import { RegistryNotMatchError, type PackageSyncerService } from './PackageSyncerService.ts';
import type { RegistryManagerService } from './RegistryManagerService.ts';
import type { TaskService } from './TaskService.ts';

@SingletonProto({ accessLevel: AccessLevel.PUBLIC })
export class PackageSyncRecheckService extends AbstractService {
  @Inject()
  private readonly packagePopularityService: PackagePopularityService;
  @Inject()
  private readonly syncRecheckQueue: SyncRecheckQueue;
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly packageRepository: PackageRepository;

  async record(registry: Registry, change: ChangesStreamChange, task: Task) {
    if (!(await this.packagePopularityService.includes(change.fullname))) return;
    await this.syncRecheckQueue.record({
      registryId: registry.registryId,
      fullname: change.fullname,
      seq: change.seq,
      version: change.version,
      taskId: task.taskId,
    });
  }

  private async isComplete(state: SyncRecheckState) {
    if (state.unknownTarget || !Object.keys(state.expectedVersions).length) return false;
    const task = await this.taskService.findTask(state.lastTaskId);
    if (task?.state !== TaskState.Success || task.error) return false;
    const [scope, name] = getScopeAndName(state.fullname);
    const result = await this.packageManagerService.listPackageFullManifests(scope, name, true);
    return (
      !result.blockReason && Object.keys(state.expectedVersions).every((version) => result.data?.versions?.[version])
    );
  }

  async dispatch() {
    if (!this.config.cnpmcore.syncRecheck.enabled) return;
    this.packagePopularityService.validateConfig();
    if (
      (await this.taskService.getTaskQueueLength(TaskType.SyncPackage)) >= this.config.cnpmcore.taskQueueHighWaterSize
    )
      return;
    const claim = await this.syncRecheckQueue.claim();
    if (!claim) return;
    const { key, state } = claim;
    const lease = state.lease!;
    try {
      if (
        !(await this.packagePopularityService.includes(state.fullname)) ||
        this.config.cnpmcore.syncPackageBlockList.includes(state.fullname) ||
        !(await this.registryManagerService.findByRegistryId(state.registryId))
      ) {
        await this.syncRecheckQueue.finish(key, state);
        return;
      }
      const [scope, name] = getScopeAndName(state.fullname);
      const pkg = await this.packageRepository.findPackage(scope, name);
      if (pkg && (pkg.isPrivate || (pkg.registryId && pkg.registryId !== state.registryId))) {
        await this.syncRecheckQueue.finish(key, state);
        return;
      }
      // Recover a dispatch that persisted before its acknowledgement, including history.
      if (state.dispatchTaskId) {
        const dispatched = await this.taskService.findTask(state.dispatchTaskId);
        if (dispatched) {
          // The database insert can succeed before the queue write fails.
          if (dispatched.state === TaskState.Waiting) await this.taskService.createTask(dispatched, true);
          await this.syncRecheckQueue.dispatched(key, state, dispatched.taskId);
          return;
        }
      } else if (await this.isComplete(state)) {
        await this.syncRecheckQueue.finish(key, state);
        return;
      }
      // A delayed check must wait until the earlier snapshot has finished.
      if (await this.taskRepository.findTaskByTargetName(state.fullname, TaskType.SyncPackage)) {
        await this.syncRecheckQueue.defer(key, lease);
        return;
      }
      const reserved = await this.syncRecheckQueue.reserve(key, lease);
      if (!reserved?.dispatchTaskId || !reserved.lease) return;
      const task = await this.packageSyncerService.createTask(state.fullname, {
        taskId: reserved.dispatchTaskId,
        maxAttempts: 1,
        registryId: state.registryId,
        authorId: 'SyncRecheck',
        skipDependencies: true,
        tips: `Delayed upstream check for seq ${reserved.seq}, attempt ${reserved.step + 1}`,
      });
      await this.syncRecheckQueue.dispatched(key, reserved, task.taskId);
      this.logger.info(
        '[PackageSyncRecheckService.dispatch] %s seq: %s task: %s',
        state.fullname,
        reserved.seq,
        task.taskId,
      );
    } catch (err) {
      if (err instanceof RegistryNotMatchError) {
        await this.syncRecheckQueue.finish(key, state);
        return;
      }
      await this.syncRecheckQueue.defer(key, lease);
      throw err;
    }
  }
}
