import os from 'os';
import { setTimeout } from 'timers/promises';
import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import {
  EggContextHttpClient,
} from 'egg';
import { TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { Task } from '../entity/Task';
import { PackageSyncerService } from './PackageSyncerService';
import { TaskService } from './TaskService';
import { RegistryRepository } from 'app/repository/RegistryRepository';
import { RegistryService } from './RegistryService';
import { Scope } from '../entity/Scope';
import { Unpack } from '../util/EntityUtil';
import { getScopeAndName } from '../../common/PackageUtil';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangesStreamService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly registryRepository: RegistryRepository;
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private readonly packageSyncerService: PackageSyncerService;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly registryService: RegistryService;

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
    if (!targetData) {
      const newTask = {
        name: registry.name,
        data: {},
      };
      targetData = newTask.data;
      task.data.push(newTask);
      await this.taskRepository.saveTask(task);
    }
    const { changeStream } = registry;
    try {
      let since: string = targetData.since;
      // get update_seq from ${changesStreamRegistry} on the first time
      if (!since) {
        const { status, data } = await this.httpclient.request(registry.changeStream + '?since=7139538', {
          followRedirect: true,
          timeout: 10000,
          dataType: 'json',
        });
        if (data.update_seq) {
          since = String(data.update_seq - 10);
        } else {
          since = '7139538';
        }
        this.logger.warn('[ChangesStreamService.executeTask:firstSeq] GET %s status: %s, data: %j, since: %s',
          changeStream, status, data, since);
        await this.taskRepository.saveTask(task);
      }
      // allow disable changesStream dynamic
      while (since && this.config.cnpmcore.enableChangesStream) {
        const { lastSince, taskCount } = await this.handleChanges(since, task, registry);
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
      targetData.error = `${err}`;
      await this.taskRepository.saveTask(task);
    }
  }

  public async executeTask(task: Task) {
    task.authorIp = os.hostname();
    task.authorId = `pid_${process.pid}`;
    task = await this.convertLegacyChangeStream(task);
    const registries = await this.registryService.list();
    await Promise.all(registries.map(registry => this._executeTask(registry, task)));
    await this.taskRepository.saveTask(task);

  }

  // check need handle the change task
  needHandle(scopes: Scope[], pkgName: string) {
    // common package registry
    if (scopes.length === 0) {
      return true;
    }
    // scoped registry do not sync common package
    const [scope] = getScopeAndName(pkgName);
    if (!scope) {
      return false;
    }
    return scopes.some(s => s.name === scope);
  }

  private async handleChanges(since: string, task: Task, registry: Unpack<ReturnType<typeof this.registryService.list>>[number]) {
    const changesStreamRegistryMode: string = this.config.cnpmcore.changesStreamRegistryMode;
    const db = `${registry.changeStream}?since=${since}&limit=2000`;
    let lastSince = since;
    let taskCount = 0;
    if (changesStreamRegistryMode === 'streaming') {
      const { res } = await this.httpclient.request(db, {
        streaming: true,
        timeout: 10000,
      });
      for await (const chunk of res) {
        const text: string = chunk.toString();
        // {"seq":7138879,"id":"@danydodson/prettier-config","changes":[{"rev":"5-a56057032714af25400d93517773a82a"}]}
        // console.log('😄%j😄', text);
        // 😄"{\"seq\":7138738,\"id\":\"wargerm\",\"changes\":[{\"rev\":\"59-f0a0d326db4c62ed480987a04ba3bf8f\"}]}"😄
        // 😄",\n{\"seq\":7138739,\"id\":\"@laffery/webpack-starter-kit\",\"changes\":[{\"rev\":\"4-84a8dc470a07872f4cdf85cf8ef892a1\"}]},\n{\"seq\":7138741,\"id\":\"venom-bot\",\"changes\":[{\"rev\":\"103-908654b1ad4b0e0fd40b468d75730674\"}]}"😄
        // 😄",\n{\"seq\":7138743,\"id\":\"react-native-template-pytorch-live\",\"changes\":[{\"rev\":\"40-871c686b200312303ba7c4f7f93e0362\"}]}"😄
        // 😄",\n{\"seq\":7138745,\"id\":\"ccxt\",\"changes\":[{\"rev\":\"10205-25367c525a0a3bd61be3a72223ce212c\"}]}"😄
        const matchs = text.matchAll(/"seq":(\d+),"id":"([^"]+)"/gm);
        let count = 0;
        let lastPackage = '';
        for (const match of matchs) {
          const seq = match[1];
          const fullname = match[2];
          if (seq && fullname) {
            if (this.needHandle(registry.scopes, fullname)) {
              await this.packageSyncerService.createTask(fullname, {
                authorIp: os.hostname(),
                authorId: 'ChangesStreamService',
                registryHost: registry.host,
                userPrefix: registry.userPrefix,
                skipDependencies: true,
                tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: ${seq}`,
              });
            }
            count++;
            lastSince = seq;
            lastPackage = fullname;
          }
        }
        if (count > 0) {
          taskCount += count;
          task.data = {
            ...task.data,
            since: lastSince,
            last_package: lastPackage,
            last_package_created: new Date(),
            task_count: (task.data.task_count || 0) + count,
          };
          await this.taskRepository.saveTask(task);
        }
      }
    } else {
      // json mode
      // {"results":[{"seq":1988653,"type":"PACKAGE_VERSION_ADDED","id":"dsr-package-mercy-magot-thorp-sward","changes":[{"version":"1.0.1"}]},
      const { data } = await this.httpclient.request(db, {
        followRedirect: true,
        timeout: 30000,
        dataType: 'json',
        gzip: true,
      });
      if (data.results?.length > 0) {
        let count = 0;
        let lastPackage = '';
        for (const change of data.results) {
          const seq = change.seq || new Date(change.gmt_modified).getTime();
          const fullname = change.id;
          if (seq && fullname && seq !== since) {
            if (this.needHandle(registry.scopes, fullname)) {
              await this.packageSyncerService.createTask(fullname, {
                authorIp: os.hostname(),
                authorId: 'ChangesStreamService',
                skipDependencies: true,
                registryHost: registry.host,
                userPrefix: registry.userPrefix,
                tips: `Sync cause by changes_stream(${registry.changeStream}) update seq: ${seq}, change: ${JSON.stringify(change)}`,
              });
            }
            count++;
            lastSince = seq;
            lastPackage = fullname;
          }
        }
        if (count > 0) {
          taskCount += count;
          task.data = {
            ...task.data,
            since: lastSince,
            last_package: lastPackage,
            last_package_created: new Date(),
            task_count: (task.data.task_count || 0) + count,
          };
          await this.taskRepository.saveTask(task);
        }
      }
    }

    if (taskCount === 0) {
      // keep update task, make sure updatedAt changed
      task.updatedAt = new Date();
      await this.taskRepository.saveTask(task);
    }
    return { lastSince, taskCount };
  }
}
