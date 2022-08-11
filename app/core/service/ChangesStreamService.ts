import os from 'os';
import { setTimeout } from 'timers/promises';
import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { Task } from '../entity/Task';
import { TaskService } from './TaskService';
import { RegistryRepository } from 'app/repository/RegistryRepository';
import { RegistryService } from './RegistryService';
import { Unpack } from '../util/EntityUtil';
import { EggContextHttpClient } from 'egg';
import { getRegistryAdapter } from '../../common/adapter/registry';
import { Registry } from '../entity/Registry';
import { PackageSyncerService } from './PackageSyncerService';
import { HandleResult } from 'app/common/adapter/registry/AbstractRegistry';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangesStreamService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly registryRepository: RegistryRepository;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly registryService: RegistryService;
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;

  public async findExecuteTask() {
    const targetName = 'GLOBAL_WORKER';
    const existsTask = await this.taskRepository.findTaskByTargetName(targetName, TaskType.ChangesStream);
    if (!existsTask) {
      await this.taskService.createTask(Task.createChangesStream(targetName), false);
    }
    return await this.taskService.findExecuteTask(TaskType.ChangesStream);
  }

  // since 2022-08-08, cnpmcore supports multiple changesStream
  async convertLegacyChangeStream(task: Task) {
    const { data } = task;
    if (Array.isArray(data)) {
      return task;
    }
    const changesStreamRegistry: string = this.config.cnpmcore.changesStreamRegistry;
    // will be npmmirror or npm registry
    const targetRegistry = await this.registryRepository.findRegistryByChangeStream(`${changesStreamRegistry}/_changes`);

    // do nothing
    if (!targetRegistry) {
      this.logger.warn('[ChangesStreamService.convertLegacyChangeStream:noTargetRegistry] %s', changesStreamRegistry);
      task.data = [
         { name: 'unknown', data, }
      ];
      return task;
    }

    // convert the single task to array
    task.data = [{
      name: targetRegistry.name,
      data,
    }];

    return task;
  }

  private async _executeTask(registry: Unpack<ReturnType<typeof this.registryService.list>>[number], task: Task) {
    let targetData = task.data.find(data => data.name === registry.name);
    const registryAdapter = this.getAdapter(registry);
    if (!targetData) {
      const newTask = {
        name: registry.name,
        data: {},
      };
      task.data.push(newTask);
      targetData = task.data[task.data.length - 1].data;
      await this.taskRepository.saveTask(task);
    }
    const { changeStream } = registry;
    try {
      let since: string = targetData.since;
      // get update_seq from ${changesStreamRegistry} on the first time
      if (!since) {
        const { status, data, ...res } = await registryAdapter.fetch(since);
        since = res.since;
        targetData.since = since;
        this.logger.warn('[ChangesStreamService.executeTask:firstSeq] GET %s status: %s, data: %j, since: %s',
          changeStream, status, data, since);
        await this.taskRepository.saveTask(task);
      }
      // allow disable changesStream dynamic
      while (since && this.config.cnpmcore.enableChangesStream) {
        const { taskData, taskCount} = await this.handleChanges(since, targetData, registry);
        Object.assign(targetData, taskData);
        task.updatedAt = new Date();
        await this.taskRepository.saveTask(task);
        this.logger.warn('[ChangesStreamService.executeTask:changes] since: %s => %s, %d new tasks, %d need to sync, taskId: %s, updatedAt: %j',
          since, targetData.since, taskCount, targetData.sync_count, task.taskId, task.updatedAt);
        since = targetData.since;
        if (taskCount === 0 && this.config.env === 'unittest') {
          break;
        }
        await setTimeout(this.config.cnpmcore.checkChangesStreamInterval);
      }
    } catch (err) {
      this.logger.error('[ChangesStreamService.executeTask:error] %s, exit now', err);
      this.logger.error(err);
      targetData.error = `${err}`;
      await this.taskRepository.saveTask(task);
    }
  }

  public async executeTask(task: Task) {
    task.authorIp = os.hostname();
    task.authorId = `pid_${process.pid}`;
    task = await this.convertLegacyChangeStream(task);
    const registries = await this.registryService.list();
    this.logger.error('[ChangesStreamService.executeTask:info] registries %j', registries.map(registry => registry.name));
    await Promise.all(registries.map(registry => this._executeTask(registry, task)));
    await this.taskRepository.saveTask(task);

  }

  private async handleChanges(since: string, task: Task, registry: Unpack<ReturnType<typeof this.registryService.list>>[number]): Promise<HandleResult> {
    const registryAdapter = this.getAdapter(registry);
    return registryAdapter.handleChanges(since, task, this.packageSyncerService);
  }

  private getAdapter(registry: Registry) {
    const Adapter = getRegistryAdapter(registry);
    return new Adapter(this.httpclient, this.logger, registry);
  }
}
