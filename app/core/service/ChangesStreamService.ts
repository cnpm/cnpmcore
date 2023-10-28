import os from 'os';
import { setTimeout } from 'timers/promises';
import {
  AccessLevel,
  SingletonProto,
  EggObjectFactory,
  Inject,
} from '@eggjs/tegg';
import { TaskState, TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { HOST_NAME, ChangesStreamTask, Task } from '../entity/Task';
import { PackageSyncerService, RegistryNotMatchError } from './PackageSyncerService';
import { TaskService } from './TaskService';
import { RegistryManagerService } from './RegistryManagerService';
import { E500 } from 'egg-errors';
import { Registry } from '../entity/Registry';
import { AbstractChangeStream } from '../../common/adapter/changesStream/AbstractChangesStream';
import { getScopeAndName } from '../../common/PackageUtil';
import { GLOBAL_WORKER } from '../../common/constants';
import { ScopeManagerService } from './ScopeManagerService';
import { PackageRepository } from '../../repository/PackageRepository';

@SingletonProto({
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
  @Inject()
  private readonly packageRepository: PackageRepository;

  // 出于向下兼容考虑, changes_stream 类型 Task 分为
  // GLOBAL_WORKER: 默认的同步源
  // `{registryName}_WORKER`: 自定义 scope 的同步源
  public async findExecuteTask(): Promise<ChangesStreamTask | null> {
    const targetName = GLOBAL_WORKER;
    const globalRegistryTask = await this.taskRepository.findTaskByTargetName(targetName, TaskType.ChangesStream);
    // 如果没有配置默认同步源，先进行初始化
    if (!globalRegistryTask) {
      await this.taskService.createTask(Task.createChangesStream(targetName), false);
    }
    // 自定义 scope 由 admin 手动创建
    // 根据 TaskType.ChangesStream 从队列中获取
    return await this.taskService.findExecuteTask(TaskType.ChangesStream) as ChangesStreamTask;
  }

  public async suspendSync(exit = false) {
    this.logger.info('[ChangesStreamService.suspendSync:start]');
    if (this.config.cnpmcore.enableChangesStream) {
      // 防止继续获取新的任务
      if (exit) {
        this.config.cnpmcore.enableChangesStream = false;
      }
      const authorIp = os.hostname();
      // 暂停当前机器所有的 changesStream 任务
      const tasks = await this.taskRepository.findTaskByAuthorIpAndType(authorIp, TaskType.ChangesStream);
      for (const task of tasks) {
        if (task.state === TaskState.Processing) {
          this.logger.info('[ChangesStreamService.suspendSync:suspend] taskId: %s', task.taskId);
          // 1. 更新任务状态为 waiting
          // 2. 重新推入任务队列供其他机器执行
          await this.taskService.retryTask(task);
        }
      }
    }
    this.logger.info('[ChangesStreamService.suspendSync:finish]');
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
        this.logger.info('[ChangesStreamService.executeTask:changes] since: %s => %s, %d new tasks, taskId: %s, updatedAt: %j',
          since, lastSince, taskCount, task.taskId, task.updatedAt);
        since = lastSince;
        if (taskCount === 0 && this.config.env === 'unittest') {
          break;
        }
        await setTimeout(this.config.cnpmcore.checkChangesStreamInterval);
      }
    } catch (err) {
      this.logger.warn('[ChangesStreamService.executeTask:error] %s, exit now', err.message);
      if (err.name === 'HttpClientRequestTimeoutError'
        || err.name === 'ConnectTimeoutError'
        || err.name === 'BodyTimeoutError') {
        this.logger.warn(err);
      } else {
        this.logger.error(err);
      }
      task.error = `${err}`;
      await this.taskRepository.saveTask(task);
      await this.suspendSync();
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

    const registry = await this.registryManagerService.ensureDefaultRegistry();
    task.data = {
      ...(task.data || {}),
      registryId: registry.registryId,
    };
    await this.taskRepository.saveTask(task);

    return registry;
  }

  // 根据 regsitry 判断是否需要添加同步任务
  // 1. 如果该包已经指定了 registryId 则以 registryId 为准
  // 1. 该包的 scope 在当前 registry 下
  // 2. 如果 registry 下没有配置 scope (认为是通用 registry 地址) ，且该包的 scope 不在其他 registry 下
  public async needSync(registry: Registry, fullname: string): Promise<boolean> {
    const [ scopeName, name ] = getScopeAndName(fullname);
    const packageEntity = await this.packageRepository.findPackage(scopeName, name);

    // 如果包不存在，且处在 exist 模式下，则不同步
    if (this.config.cnpmcore.syncMode === 'exist' && !packageEntity) {
      return false;
    }

    if (packageEntity?.registryId) {
      return registry.registryId === packageEntity.registryId;
    }

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
    // 需要根据 scope 和包信息进行过滤
    const stream = changesStreamAdapter.fetchChanges(registry, since);
    let lastPackage: string | undefined;

    // 创建同步任务
    for await (const change of stream) {
      const { fullname, seq } = change;
      lastPackage = fullname;
      lastSince = seq;
      const valid = await this.needSync(registry, fullname);
      if (valid) {
        taskCount++;
        const tips = `Sync cause by changes_stream(${registry.changeStream}) update seq: ${seq}`;
        try {
          const task = await this.packageSyncerService.createTask(fullname, {
            authorIp: HOST_NAME,
            authorId: 'ChangesStreamService',
            registryId: registry.registryId,
            skipDependencies: true,
            tips,
          });
          this.logger.info('[ChangesStreamService.createTask:success] fullname: %s, task: %s, tips: %s',
            fullname, task.id, tips);
        } catch (err) {
          if (err instanceof RegistryNotMatchError) {
            this.logger.warn('[ChangesStreamService.executeSync:skip] fullname: %s, error: %s, tips: %s',
              fullname, err, tips);
            continue;
          }
          // only log error, make sure changes still reading
          this.logger.error('[ChangesStreamService.executeSync:error] fullname: %s, error: %s, tips: %s',
            fullname, err, tips);
          this.logger.error(err);
          continue;
        }
      }
      // 实时更新 task 信息
      // 即使不需要同步，防止任务处理累积耗时超过 10min
      task.updateSyncData({
        lastSince,
        lastPackage,
        taskCount,
      });
      await this.taskRepository.saveTask(task);
    }

    // 如果 taskCount 为 0 更新一下任务信息
    if (taskCount === 0) {
      task.updateSyncData({
        lastSince,
        lastPackage,
        taskCount,
      });
      await this.taskRepository.saveTask(task);
    }

    return { lastSince, taskCount };
  }
}
