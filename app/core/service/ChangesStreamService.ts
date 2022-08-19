import os from 'os';
import { setTimeout } from 'timers/promises';
import {
  AccessLevel,
  ContextProto,
  EggObjectFactory,
  Inject,
} from '@eggjs/tegg';
import { TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { HOST_NAME, ChangesStreamTask, Task } from '../entity/Task';
import { PackageSyncerService } from './PackageSyncerService';
import { TaskService } from './TaskService';
import { RegistryManagerService } from './RegistryManagerService';
import { RegistryType } from '../../common/enum/Registry';
import { E500 } from 'egg-errors';
import { Registry } from '../entity/Registry';
import { AbstractChangeStream, ChangesStreamChange } from '../../common/adapter/changesStream/AbstractChangesStream';
import { getScopeAndName } from '../../common/PackageUtil';
import { ScopeManagerService } from './ScopeManagerService';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangesStreamService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly registryManagerService : RegistryManagerService;
  @Inject()
  private readonly scopeManagerService : ScopeManagerService;
  @Inject()
  private readonly eggObjectFactory: EggObjectFactory;

  public async findExecuteTask(): Promise<ChangesStreamTask | null> {
    const targetName = 'GLOBAL_WORKER';
    const existsTask = await this.taskRepository.findTaskByTargetName(targetName, TaskType.ChangesStream);
    if (!existsTask) {
      await this.taskService.createTask(Task.createChangesStream(targetName), false);
    }
    return await this.taskService.findExecuteTask(TaskType.ChangesStream) as ChangesStreamTask;
  }

  public async executeTask(task: ChangesStreamTask) {
    task.authorIp = os.hostname();
    task.authorId = `pid_${process.pid}`;
    await this.taskRepository.saveTask(task);

    // 初始化 changeStream 任务
    // since 默认从 1 开始
    try {
      let since: string = task.data.since;
      if (!since) {
        since = await this.getInitialSince(task);
      }
      // allow disable changesStream dynamic
      while (since && this.config.cnpmcore.enableChangesStream) {
        const { lastSince, taskCount } = await this.executeSync(since, task);
        this.logger.warn('[ChangesStreamService.executeTask:changes] since: %s => %s, %d new tasks, taskId: %s, updatedAt: %j',
          since, lastSince, taskCount, task.taskId, task.updatedAt);
        since = lastSince;
        if (taskCount === 0 && this.config.env === 'unittest') {
          break;
        }
        await setTimeout(this.config.cnpmcore.checkChangesStreamInterval);
      }
    } catch (err) {
      this.logger.error('[ChangesStreamService.executeTask:error] %s, exit now', err);
      this.logger.error(err);
      task.error = `${err}`;
      await this.taskRepository.saveTask(task);
    }
  }

  // 优先从 registryId 获取，如果没有的话再返回默认的 registry
  public async prepareRegistry(task: ChangesStreamTask): Promise<Registry> {
    const { registryId } = task.data || {};
    // 如果已有 registryId, 查询 DB 直接获取
    if (registryId) {
      const registry = await this.registryManagerService.findByRegistryId(registryId);
      if (!registry) {
        this.logger.error('[ChangesStreamService.getRegistry:error] registryId %s not found', registryId);
        throw new E500(`invalid change stream registry: ${registryId}`);
      }
      return registry;
    }

    // 从配置文件默认生成
    const { changesStreamRegistryMode, changesStreamRegistry: host } = this.config.cnpmcore;
    const type = changesStreamRegistryMode === 'json' ? 'cnpmcore' : 'npm';
    const registry = await this.registryManagerService.createRegistry({
      name: 'default',
      type: type as RegistryType,
      userPrefix: 'npm:',
      host,
      changeStream: `${host}/_changes`,
    });
    task.data = {
      ...(task.data || {}),
      registryId: registry.registryId,
    };
    await this.taskRepository.saveTask(task);

    return registry;
  }

  // 根据 regsitry 判断是否需要添加同步任务
  // 1. 该包的 scope 在当前 registry 下
  // 2. 如果 registry 下没有配置 scope (认为是通用 registry 地址) ，且该包的 scope 不在其他 registry 下
  public async needSync(registry: Registry, fullname: string): Promise<boolean> {
    const [ scopeName ] = getScopeAndName(fullname);
    const scope = await this.scopeManagerService.findByName(scopeName);

    const inCurrentRegistry = scope && scope?.registryId === registry.registryId;
    if (inCurrentRegistry) {
      return true;
    }

    const registryScopeCount = await this.scopeManagerService.countByRegistryId(registry.registryId);
    // 当前包没有 scope 信息，且当前 registry 下没有 scope，是通用 registry，需要同步
    return !scope && !registryScopeCount;
  }
  public async getInitialSince(task: ChangesStreamTask): Promise<string> {
    const registry = await this.prepareRegistry(task);
    const changesStreamAdapter = await this.eggObjectFactory.getEggObject(AbstractChangeStream, registry.type) as AbstractChangeStream;
    const since = await changesStreamAdapter.getInitialSince(registry);
    return since;
  }

  // 从 changesStream 获取需要同步的数据
  // 更新任务的 since 和 taskCount 相关字段
  public async executeSync(since: string, task: ChangesStreamTask) {
    const registry = await this.prepareRegistry(task);
    const changesStreamAdapter = await this.eggObjectFactory.getEggObject(AbstractChangeStream, registry.type) as AbstractChangeStream;
    let taskCount = 0;
    let lastSince = since;

    // 获取需要同步的数据
    // 只获取需要同步的 task 信息
    const stream = await changesStreamAdapter.fetchChanges(registry, since);
    let lastPackage: string | undefined;

    // 创建同步任务
    for await (const change of stream) {
      const { fullname, seq } = change as ChangesStreamChange;
      lastPackage = fullname;
      const valid = await this.needSync(registry, fullname);
      if (valid) {
        taskCount++;
        lastSince = seq;
        await this.packageSyncerService.createTask(fullname, {
          authorIp: HOST_NAME,
          authorId: 'ChangesStreamService',
          skipDependencies: true,
          tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: ${seq}`,
        });
        // 实时更新 task 信息
        task.updateSyncData({
          lastSince,
          lastPackage,
          taskCount,
        });
        await this.taskRepository.saveTask(task);
      }
    }

    return { lastSince, taskCount };
  }
}
