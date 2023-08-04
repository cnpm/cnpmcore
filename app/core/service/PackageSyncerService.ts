import os from 'os';
import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { Pointcut } from '@eggjs/tegg/aop';
import { EggHttpClient } from 'egg';
import { setTimeout } from 'timers/promises';
import { rm } from 'fs/promises';
import { isEqual, isEmpty } from 'lodash';
import semver from 'semver';
import semverRcompare from 'semver/functions/rcompare';
import semverPrerelease from 'semver/functions/prerelease';
import { NPMRegistry, RegistryResponse } from '../../common/adapter/NPMRegistry';
import { detectInstallScript, getScopeAndName } from '../../common/PackageUtil';
import { downloadToTempfile } from '../../common/FileUtil';
import { TaskState, TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { PackageJSONType, PackageRepository } from '../../repository/PackageRepository';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { UserRepository } from '../../repository/UserRepository';
import { Task, SyncPackageTaskOptions, CreateSyncPackageTask } from '../entity/Task';
import { Package } from '../entity/Package';
import { UserService } from './UserService';
import { TaskService } from './TaskService';
import { PackageManagerService } from './PackageManagerService';
import { CacheService } from './CacheService';
import { User } from '../entity/User';
import { RegistryManagerService } from './RegistryManagerService';
import { Registry } from '../entity/Registry';
import { BadRequestError } from 'egg-errors';
import { ScopeManagerService } from './ScopeManagerService';
import { EventCorkAdvice } from './EventCorkerAdvice';
import { PresetRegistryName, SyncDeleteMode } from '../../common/constants';

type syncDeletePkgOptions = {
  task: Task,
  pkg: Package | null,
  logUrl: string,
  url: string,
  logs: string[],
  data: any,
};

function isoNow() {
  return new Date().toISOString();
}

export class RegistryNotMatchError extends BadRequestError {
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageSyncerService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;
  @Inject()
  private readonly userRepository: UserRepository;
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly userService: UserService;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly cacheService: CacheService;
  @Inject()
  private readonly httpclient: EggHttpClient;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly scopeManagerService: ScopeManagerService;

  public async createTask(fullname: string, options?: SyncPackageTaskOptions) {
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    // sync task request registry is not same as package registry
    if (pkg && pkg.registryId && options?.registryId) {
      if (pkg.registryId !== options.registryId) {
        throw new RegistryNotMatchError(`package ${fullname} is not in registry ${options.registryId}`);
      }
    }
    return await this.taskService.createTask(Task.createSyncPackage(fullname, options), true);
  }

  public async findTask(taskId: string) {
    return await this.taskService.findTask(taskId);
  }

  public async findTaskLog(task: Task) {
    return await this.taskService.findTaskLog(task);
  }

  public async findExecuteTask() {
    return await this.taskService.findExecuteTask(TaskType.SyncPackage) as CreateSyncPackageTask;
  }

  public get allowSyncDownloadData() {
    const config = this.config.cnpmcore;
    if (config.enableSyncDownloadData && config.syncDownloadDataSourceRegistry && config.syncDownloadDataMaxDate) {
      return true;
    }
    return false;
  }

  private async syncDownloadData(task: Task, pkg: Package) {
    if (!this.allowSyncDownloadData) {
      return;
    }
    const fullname = pkg.fullname;
    const start = '2011-01-01';
    const end = this.config.cnpmcore.syncDownloadDataMaxDate;
    const registry = this.config.cnpmcore.syncDownloadDataSourceRegistry;
    const logs: string[] = [];
    let downloads: { day: string; downloads: number }[];

    logs.push(`[${isoNow()}][DownloadData] 🚧🚧🚧🚧🚧 Syncing "${fullname}" download data "${start}:${end}" on ${registry} 🚧🚧🚧🚧🚧`);
    const failEnd = '❌❌❌❌❌ 🚮 give up 🚮 ❌❌❌❌❌';
    try {
      const { remoteAuthToken } = task.data as SyncPackageTaskOptions;
      const { data, status, res } = await this.npmRegistry.getDownloadRanges(registry, fullname, start, end, { remoteAuthToken });
      downloads = data.downloads || [];
      logs.push(`[${isoNow()}][DownloadData] 🚧 HTTP [${status}] timing: ${JSON.stringify(res.timing)}, downloads: ${downloads.length}`);
    } catch (err: any) {
      const status = err.status || 'unknow';
      logs.push(`[${isoNow()}][DownloadData] ❌ Get download data error: ${err}, status: ${status}`);
      logs.push(`[${isoNow()}][DownloadData] ${failEnd}`);
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      return;
    }
    const datas = new Map<number, [string, number][]>();
    for (const item of downloads) {
      // {
      //   "day": "2021-09-21",
      //   "downloads": 45
      // },
      const day = item.day;
      const [ year, month, date ] = day.split('-');
      const yearMonth = parseInt(`${year}${month}`);
      if (!datas.has(yearMonth)) {
        datas.set(yearMonth, []);
      }
      const counters = datas.get(yearMonth);
      counters!.push([ date, item.downloads ]);
    }
    for (const [ yearMonth, counters ] of datas.entries()) {
      await this.packageVersionDownloadRepository.saveSyncDataByMonth(pkg.packageId, yearMonth, counters);
      logs.push(`[${isoNow()}][DownloadData] 🟢 ${yearMonth}: ${counters.length} days`);
    }
    logs.push(`[${isoNow()}][DownloadData] 🟢🟢🟢🟢🟢 ${registry}/${fullname} 🟢🟢🟢🟢🟢`);
    await this.taskService.appendTaskLog(task, logs.join('\n'));
  }

  private async syncUpstream(task: Task) {
    const registry = this.npmRegistry.registry;
    const fullname = task.targetName;
    const { remoteAuthToken } = task.data as SyncPackageTaskOptions;
    let logs: string[] = [];
    let logId = '';
    logs.push(`[${isoNow()}][UP] 🚧🚧🚧🚧🚧 Waiting sync "${fullname}" task on ${registry} 🚧🚧🚧🚧🚧`);
    const failEnd = `❌❌❌❌❌ Sync ${registry}/${fullname} 🚮 give up 🚮 ❌❌❌❌❌`;
    try {
      const { data, status, res } = await this.npmRegistry.createSyncTask(fullname, { remoteAuthToken });
      logs.push(`[${isoNow()}][UP] 🚧 HTTP [${status}] timing: ${JSON.stringify(res.timing)}, data: ${JSON.stringify(data)}`);
      logId = data.logId;
    } catch (err: any) {
      const status = err.status || 'unknow';
      logs.push(`[${isoNow()}][UP] ❌ Sync ${fullname} fail, create sync task error: ${err}, status: ${status}`);
      logs.push(`[${isoNow()}][UP] ${failEnd}`);
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      return;
    }
    if (!logId) {
      logs.push(`[${isoNow()}][UP] ❌ Sync ${fullname} fail, missing logId`);
      logs.push(`[${isoNow()}][UP] ${failEnd}`);
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      return;
    }
    const startTime = Date.now();
    const maxTimeout = this.config.cnpmcore.sourceRegistrySyncTimeout;
    let logUrl = '';
    let offset = 0;
    let useTime = Date.now() - startTime;
    while (useTime < maxTimeout) {
      // sleep 1s ~ 6s in random
      const delay = process.env.NODE_ENV === 'test' ? 100 : 1000 + Math.random() * 5000;
      await setTimeout(delay);
      try {
        const { data, status, url } = await this.npmRegistry.getSyncTask(fullname, logId, offset, { remoteAuthToken });
        useTime = Date.now() - startTime;
        if (!logUrl) {
          logUrl = url;
        }
        const log = data && data.log || '';
        offset += log.length;
        if (data && data.syncDone) {
          logs.push(`[${isoNow()}][UP] 🟢 Sync ${fullname} success [${useTime}ms], log: ${logUrl}, offset: ${offset}`);
          logs.push(`[${isoNow()}][UP] 🟢🟢🟢🟢🟢 ${registry}/${fullname} 🟢🟢🟢🟢🟢`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          return;
        }
        logs.push(`[${isoNow()}][UP] 🚧 HTTP [${status}] [${useTime}ms], offset: ${offset}`);
        await this.taskService.appendTaskLog(task, logs.join('\n'));
        logs = [];
      } catch (err: any) {
        useTime = Date.now() - startTime;
        const status = err.status || 'unknow';
        logs.push(`[${isoNow()}][UP] 🚧 HTTP [${status}] [${useTime}ms] error: ${err}`);
      }
    }
    // timeout
    logs.push(`[${isoNow()}][UP] ❌ Sync ${fullname} fail, timeout, log: ${logUrl}, offset: ${offset}`);
    logs.push(`[${isoNow()}][UP] ${failEnd}`);
    await this.taskService.appendTaskLog(task, logs.join('\n'));
  }

  private isRemovedInRemote(remoteFetchResult: RegistryResponse) {
    const { status, data } = remoteFetchResult;

    // deleted or blocked
    if (status === 404 || status === 451) {
      return true;
    }

    const hasMaintainers = data?.maintainers && data?.maintainers.length !== 0;
    if (hasMaintainers) {
      return false;
    }

    // unpublished
    const timeMap = data.time || {};
    if (timeMap.unpublished) {
      return true;
    }

    // security holder
    // test/fixtures/registry.npmjs.org/security-holding-package.json
    let isSecurityHolder = true;
    for (const versionInfo of Object.entries<{ _npmUser?: { name: string } }>(data.versions || {})) {
      const [ v, info ] = versionInfo;
      // >=0.0.1-security <0.0.2-0
      const isSecurityVersion = semver.satisfies(v, '^0.0.1-security');
      const isNpmUser = info?._npmUser?.name === 'npm';
      if (!isSecurityVersion || !isNpmUser) {
        isSecurityHolder = false;
        break;
      }
    }

    return isSecurityHolder;
  }

  // sync deleted package, deps on the syncDeleteMode
  // - ignore: do nothing, just finish the task
  // - delete: remove the package from local registry
  // - block: block the package, update the manifest.block, instead of delete versions
  // 根据 syncDeleteMode 配置，处理删包场景
  // - ignore: 不做任何处理，直接结束任务
  // - delete: 删除包数据，包括 manifest 存储
  // - block: 软删除 将包标记为 block，用户无法直接使用
  private async syncDeletePkg({ task, pkg, logUrl, url, logs, data }: syncDeletePkgOptions) {
    const fullname = task.targetName;
    const failEnd = `❌❌❌❌❌ ${url || fullname} ❌❌❌❌❌`;
    const syncDeleteMode: SyncDeleteMode = this.config.cnpmcore.syncDeleteMode;
    logs.push(`[${isoNow()}] 🟢 Package "${fullname}" was removed in remote registry, response data: ${JSON.stringify(data)}, config.syncDeleteMode = ${syncDeleteMode}`);

    // pkg not exists in local registry
    if (!pkg) {
      task.error = `Package not exists, response data: ${JSON.stringify(data)}`;
      logs.push(`[${isoNow()}] ❌ ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ${failEnd}`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:fail-404] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      return;
    }

    if (syncDeleteMode === SyncDeleteMode.ignore) {
      // ignore deleted package
      logs.push(`[${isoNow()}] 🟢 Skip remove since config.syncDeleteMode = ignore`);
    } else if (syncDeleteMode === SyncDeleteMode.block) {
      // block deleted package
      await this.packageManagerService.blockPackage(pkg, 'Removed in remote registry');
      logs.push(`[${isoNow()}] 🟢 Block the package since config.syncDeleteMode = block`);
    } else if (syncDeleteMode === SyncDeleteMode.delete) {
      // delete package
      await this.packageManagerService.unpublishPackage(pkg);
      logs.push(`[${isoNow()}] 🟢 Delete the package since config.syncDeleteMode = delete`);
    }

    // update log
    logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
    logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${url} 🟢🟢🟢🟢🟢`);
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
    this.logger.info('[PackageSyncerService.executeTask:remove-package] taskId: %s, targetName: %s',
      task.taskId, task.targetName);

  }

  // 初始化对应的 Registry
  // 1. 优先从 pkg.registryId 获取 (registryId 一经设置 不应改变)
  // 1. 其次从 task.data.registryId (创建单包同步任务时传入)
  // 2. 接着根据 scope 进行计算 (作为子包依赖同步时候，无 registryId)
  // 3. 最后返回 default registryId (可能 default registry 也不存在)
  public async initSpecRegistry(task: Task, pkg: Package | null = null, scope?: string): Promise<Registry> {
    const registryId = pkg?.registryId || (task.data as SyncPackageTaskOptions).registryId;
    let targetHost: string = this.config.cnpmcore.sourceRegistry;
    let registry: Registry | null = null;

    // 当前任务作为 deps 引入时，不会配置 registryId
    // 历史 Task 可能没有配置 registryId
    if (registryId) {
      registry = await this.registryManagerService.findByRegistryId(registryId);
    } else if (scope) {
      const scopeModel = await this.scopeManagerService.findByName(scope);
      if (scopeModel?.registryId) {
        registry = await this.registryManagerService.findByRegistryId(scopeModel?.registryId);
      }
    }

    // 采用默认的 registry
    if (!registry) {
      registry = await this.registryManagerService.ensureDefaultRegistry();
    }

    // 更新 targetHost 地址
    // defaultRegistry 可能还未创建
    if (registry?.host) {
      targetHost = registry.host;
    }
    this.npmRegistry.setRegistryHost(targetHost);
    return registry;
  }

  // 由于 cnpmcore 将 version 和 tag 作为两个独立的 changes 事件分发
  // 普通版本发布时，短时间内会有两条相同 task 进行同步
  // 尽量保证读取和写入都需保证任务幂等，需要确保 changes 在同步任务完成后再触发
  // 通过 DB 唯一索引来保证任务幂等，插入失败不影响 pkg.manifests 更新
  // 通过 eventBus.cork/uncork 来暂缓事件触发
  @Pointcut(EventCorkAdvice)
  public async executeTask(task: Task) {
    const fullname = task.targetName;
    const [ scope, name ] = getScopeAndName(fullname);
    const { tips, skipDependencies: originSkipDependencies, syncDownloadData, forceSyncHistory, remoteAuthToken, specificVersions } = task.data as SyncPackageTaskOptions;
    let pkg = await this.packageRepository.findPackage(scope, name);
    const registry = await this.initSpecRegistry(task, pkg, scope);
    const registryHost = this.npmRegistry.registry;
    let logs: string[] = [];
    if (tips) {
      logs.push(`[${isoNow()}] 👉👉👉👉👉 Tips: ${tips} 👈👈👈👈👈`);
    }
    const taskQueueLength = await this.taskService.getTaskQueueLength(task.type);
    const taskQueueHighWaterSize = this.config.cnpmcore.taskQueueHighWaterSize;
    const taskQueueInHighWaterState = taskQueueLength >= taskQueueHighWaterSize;
    const skipDependencies = taskQueueInHighWaterState ? true : !!originSkipDependencies;
    const syncUpstream = !!(!taskQueueInHighWaterState && this.config.cnpmcore.sourceRegistryIsCNpm && this.config.cnpmcore.syncUpstreamFirst && registry.name === PresetRegistryName.default);
    const logUrl = `${this.config.cnpmcore.registry}/-/package/${fullname}/syncs/${task.taskId}/log`;
    this.logger.info('[PackageSyncerService.executeTask:start] taskId: %s, targetName: %s, attempts: %s, taskQueue: %s/%s, syncUpstream: %s, log: %s',
      task.taskId, task.targetName, task.attempts, taskQueueLength, taskQueueHighWaterSize, syncUpstream, logUrl);
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Syncing from ${registryHost}/${fullname}, skipDependencies: ${skipDependencies}, syncUpstream: ${syncUpstream}, syncDownloadData: ${!!syncDownloadData}, forceSyncHistory: ${!!forceSyncHistory} attempts: ${task.attempts}, worker: "${os.hostname()}/${process.pid}", taskQueue: ${taskQueueLength}/${taskQueueHighWaterSize} 🚧🚧🚧🚧🚧`);
    if (specificVersions) {
      logs.push(`[${isoNow()}] 👉 syncing specific versions: ${specificVersions.join(' | ')} 👈`);
    }
    logs.push(`[${isoNow()}] 🚧 log: ${logUrl}`);

    if (registry?.name === PresetRegistryName.self) {
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} has been published to the self registry, skip sync ❌❌❌❌❌`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:fail] taskId: %s, targetName: %s, invalid registryId',
        task.taskId, task.targetName);
      return;
    }

    if (pkg && pkg?.registryId !== registry?.registryId) {
      if (pkg.registryId) {
        logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} registry is ${pkg.registryId} not belong to ${registry?.registryId}, skip sync ❌❌❌❌❌`);
        await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
        this.logger.info('[PackageSyncerService.executeTask:fail] taskId: %s, targetName: %s, invalid registryId',
          task.taskId, task.targetName);
        return;
      }
      // 多同步源之前没有 registryId
      // publish() 版本不变时，不会更新 registryId
      // 在同步前，进行更新操作
      pkg.registryId = registry?.registryId;
      await this.packageRepository.savePackage(pkg);
    }

    if (syncDownloadData && pkg) {
      await this.syncDownloadData(task, pkg);
      logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
      logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 Sync "${fullname}" download data success 🟢🟢🟢🟢🟢`);
      await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:success] taskId: %s, targetName: %s',
        task.taskId, task.targetName);
      return;
    }

    if (syncUpstream) {
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      logs = [];
      // create sync task on sourceRegistry and skipDependencies = true
      await this.syncUpstream(task);
    }

    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      task.error = `stop sync by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`;
      logs.push(`[${isoNow()}] ❌ ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} ❌❌❌❌❌`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:fail-block-list] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      return;
    }

    let registryFetchResult: RegistryResponse;
    try {
      registryFetchResult = await this.npmRegistry.getFullManifests(fullname, { remoteAuthToken });
    } catch (err: any) {
      const status = err.status || 'unknown';
      task.error = `request manifests error: ${err}, status: ${status}`;
      logs.push(`[${isoNow()}] ❌ Synced ${fullname} fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} ❌❌❌❌❌`);
      this.logger.info('[PackageSyncerService.executeTask:fail-request-error] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      await this.taskService.retryTask(task, logs.join('\n'));
      return;
    }

    const { url, data, headers, res, status } = registryFetchResult;
    /* c8 ignore next 13 */
    if (status >= 500 || !data) {
      // GET https://registry.npmjs.org/%40modern-js%2Fstyle-compiler?t=1683348626499&cache=0, status: 522
      // registry will response status 522 and data will be null
      // > TypeError: Cannot read properties of null (reading 'readme')
      task.error = `request manifests response error, status: ${status}, data: ${JSON.stringify(data)}`;
      logs.push(`[${isoNow()}] ❌ response headers: ${JSON.stringify(headers)}`);
      logs.push(`[${isoNow()}] ❌ Synced ${fullname} fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} ❌❌❌❌❌`);
      this.logger.info('[PackageSyncerService.executeTask:fail-request-error] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      await this.taskService.retryTask(task, logs.join('\n'));
      return;
    }

    let readme = data.readme || '';
    if (typeof readme !== 'string') {
      readme = JSON.stringify(readme);
    }
    // "time": {
    //   "created": "2021-03-27T12:30:23.891Z",
    //   "0.0.2": "2021-03-27T12:30:24.349Z",
    //   "modified": "2021-12-08T14:59:57.264Z",
    const timeMap = data.time || {};
    const failEnd = `❌❌❌❌❌ ${url || fullname} ❌❌❌❌❌`;
    const contentLength = headers['content-length'] || '-';
    logs.push(`[${isoNow()}] HTTP [${status}] content-length: ${contentLength}, timing: ${JSON.stringify(res.timing)}`);

    if (this.isRemovedInRemote(registryFetchResult)) {
      await this.syncDeletePkg({ task, pkg, logs, logUrl, url, data });
      return;
    }

    const versionMap = data.versions || {};
    const distTags = data['dist-tags'] || {};

    // show latest information
    if (distTags.latest) {
      logs.push(`[${isoNow()}] 📖 ${fullname} latest version: ${distTags.latest ?? '-'}, published time: ${JSON.stringify(timeMap[distTags.latest])}`);
    }

    // 1. save maintainers
    // maintainers: [
    //   { name: 'bomsy', email: 'b4bomsy@gmail.com' },
    //   { name: 'jasonlaster11', email: 'jason.laster.11@gmail.com' }
    // ],
    let maintainers = data.maintainers;
    const maintainersMap = {};
    const users: User[] = [];
    let changedUserCount = 0;
    if (!Array.isArray(maintainers) || maintainers.length === 0) {
      // https://r.cnpmjs.org/webpack.js.org/sync/log/61dbc7c8ff747911a5701068
      // https://registry.npmjs.org/webpack.js.org
      // security holding package will not contains maintainers, auto set npm and npm@npmjs.com to maintainer
      // "description": "security holding package",
      // "repository": "npm/security-holder"
      if (data.description === 'security holding package' || data.repository === 'npm/security-holder') {
        maintainers = data.maintainers = [{ name: 'npm', email: 'npm@npmjs.com' }];
      } else {
        // try to use latest tag version's maintainers instead
        const latestPackageVersion = distTags.latest && versionMap[distTags.latest];
        if (latestPackageVersion && Array.isArray(latestPackageVersion.maintainers)) {
          maintainers = latestPackageVersion.maintainers;
          logs.push(`[${isoNow()}] 📖 Use the latest version(${latestPackageVersion.version}) maintainers instead`);
        }
      }
    }

    if (Array.isArray(maintainers) && maintainers.length > 0) {
      logs.push(`[${isoNow()}] 🚧 Syncing maintainers: ${JSON.stringify(maintainers)}`);
      for (const maintainer of maintainers) {
        if (maintainer.name && maintainer.email) {
          maintainersMap[maintainer.name] = maintainer;
          const { changed, user } = await this.userService.saveUser(registry?.userPrefix, maintainer.name, maintainer.email);
          users.push(user);
          if (changed) {
            changedUserCount++;
            logs.push(`[${isoNow()}] 🟢 [${changedUserCount}] Synced ${maintainer.name} => ${user.name}(${user.userId})`);
          }
        }
      }
    }

    if (users.length === 0) {
      // check unpublished
      // https://r.cnpmjs.org/-/package/babel-plugin-autocss/syncs/61e4be46c7cbfac94d2ec597/log
      // {
      //   "name": "babel-plugin-autocss",
      //   "time": {
      //     "created": "2021-10-29T08:21:56.032Z",
      //     "0.0.1": "2021-10-29T08:21:56.206Z",
      //     "modified": "2022-01-14T12:34:23.941Z",
      //     "unpublished": {
      //       "time": "2022-01-14T12:34:23.941Z",
      //       "versions": [
      //         "0.0.1"
      //       ]
      //     }
      //   }
      // }

      // invalid maintainers, sync fail
      task.error = `invalid maintainers: ${JSON.stringify(maintainers)}`;
      logs.push(`[${isoNow()}] ❌ ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ${failEnd}`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:fail-invalid-maintainers] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      return;
    }

    let lastErrorMessage = '';
    const dependenciesSet = new Set<string>();
    const { data: existsData } = await this.packageManagerService.listPackageFullManifests(scope, name);
    const { data: abbreviatedManifests } = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name);
    const existsVersionMap = existsData?.versions ?? {};
    const existsVersionCount = Object.keys(existsVersionMap).length;
    const abbreviatedVersionMap = abbreviatedManifests?.versions ?? {};
    // 2. save versions
    if (specificVersions && !this.config.cnpmcore.strictSyncSpecivicVersion && !specificVersions.includes(distTags.latest)) {
      logs.push(`[${isoNow()}] 📦 Add latest tag version "${fullname}: ${distTags.latest}"`);
      specificVersions.push(distTags.latest);
    }
    const versions: PackageJSONType[] = specificVersions ? Object.values<any>(versionMap).filter(verItem => specificVersions.includes(verItem.version)) : Object.values<any>(versionMap);
    logs.push(`[${isoNow()}] 🚧 Syncing versions ${existsVersionCount} => ${versions.length}`);
    if (specificVersions) {
      const availableVersionList = versions.map(item => item.version);
      let notAvailableVersionList = specificVersions.filter(i => !availableVersionList.includes(i));
      if (notAvailableVersionList.length > 0) {
        notAvailableVersionList = Array.from(new Set(notAvailableVersionList));
        logs.push(`[${isoNow()}] 🚧 Some specific versions are not available: 👉 ${notAvailableVersionList.join(' | ')} 👈`);
      }
    }
    const updateVersions: string[] = [];
    const differentMetas: [PackageJSONType, Partial<PackageJSONType>][] = [];
    let syncIndex = 0;
    for (const item of versions) {
      const version: string = item.version;
      if (!version) continue;
      let existsItem: typeof existsVersionMap[string] | undefined = existsVersionMap[version];
      let existsAbbreviatedItem: typeof abbreviatedVersionMap[string] | undefined = abbreviatedVersionMap[version];
      const shouldDeleteReadme = !!(existsItem && 'readme' in existsItem);
      if (pkg) {
        if (existsItem) {
          // check item on AbbreviatedManifests
          if (!existsAbbreviatedItem) {
            updateVersions.push(version);
            logs.push(`[${isoNow()}] 🐛 Remote version ${version} not exists on local abbreviated manifests, need to refresh`);
          }
        }

        if (existsItem && forceSyncHistory === true) {
          const pkgVer = await this.packageRepository.findPackageVersion(pkg.packageId, version);
          if (pkgVer) {
            logs.push(`[${isoNow()}] 🚧 [${syncIndex}] Remove version ${version} for force sync history`);
            await this.packageManagerService.removePackageVersion(pkg, pkgVer, true);
            existsItem = undefined;
            existsAbbreviatedItem = undefined;
            existsVersionMap[version] = undefined;
            abbreviatedVersionMap[version] = undefined;
          }
        }
      }

      if (existsItem) {
        // check metaDataKeys, if different value, override exists one
        // https://github.com/cnpm/cnpmjs.org/issues/1667
        // need libc field https://github.com/cnpm/cnpmcore/issues/187
        // fix _npmUser field since https://github.com/cnpm/cnpmcore/issues/553
        const metaDataKeys = [ 'peerDependenciesMeta', 'os', 'cpu', 'libc', 'workspaces', 'hasInstallScript', 'deprecated', '_npmUser' ];
        const ignoreInAbbreviated = [ '_npmUser' ];
        const diffMeta: Partial<PackageJSONType> = {};
        for (const key of metaDataKeys) {
          let remoteItemValue = item[key];
          // make sure hasInstallScript exists
          if (key === 'hasInstallScript' && remoteItemValue === undefined) {
            if (detectInstallScript(item)) {
              remoteItemValue = true;
            }
          }
          if (!isEqual(remoteItemValue, existsItem[key])) {
            diffMeta[key] = remoteItemValue;
          } else if (!ignoreInAbbreviated.includes(key) && existsAbbreviatedItem && !isEqual(remoteItemValue, existsAbbreviatedItem[key])) {
            // should diff exists abbreviated item too
            diffMeta[key] = remoteItemValue;
          }
        }
        // should delete readme
        if (shouldDeleteReadme) {
          diffMeta.readme = undefined;
        }
        if (!isEmpty(diffMeta)) {
          differentMetas.push([ existsItem, diffMeta ]);
        }
        continue;
      }
      syncIndex++;
      const description = item.description;
      // "dist": {
      //   "shasum": "943e0ec03df00ebeb6273a5b94b916ba54b47581",
      //   "tarball": "https://registry.npmjs.org/foo/-/foo-1.0.0.tgz"
      // },
      const dist = item.dist;
      const tarball = dist && dist.tarball;
      if (!tarball) {
        lastErrorMessage = `missing tarball, dist: ${JSON.stringify(dist)}`;
        logs.push(`[${isoNow()}] ❌ [${syncIndex}] Synced version ${version} fail, ${lastErrorMessage}`);
        await this.taskService.appendTaskLog(task, logs.join('\n'));
        logs = [];
        continue;
      }
      const publishTimeISO = timeMap[version];
      const publishTime = publishTimeISO ? new Date(publishTimeISO) : new Date();
      const delay = Date.now() - publishTime.getTime();
      logs.push(`[${isoNow()}] 🚧 [${syncIndex}] Syncing version ${version}, delay: ${delay}ms [${publishTimeISO}], tarball: ${tarball}`);
      let localFile: string;
      try {
        const { tmpfile, headers, timing } =
          await downloadToTempfile(this.httpclient, this.config.dataDir, tarball, { remoteAuthToken });
        localFile = tmpfile;
        logs.push(`[${isoNow()}] 🚧 [${syncIndex}] HTTP content-length: ${headers['content-length']}, timing: ${JSON.stringify(timing)} => ${localFile}`);
      } catch (err: any) {
        this.logger.error('Download tarball %s error: %s', tarball, err);
        lastErrorMessage = `download tarball error: ${err}`;
        logs.push(`[${isoNow()}] ❌ [${syncIndex}] Synced version ${version} fail, ${lastErrorMessage}`);
        await this.taskService.appendTaskLog(task, logs.join('\n'));
        logs = [];
        continue;
      }
      if (!pkg) {
        pkg = await this.packageRepository.findPackage(scope, name);
      }

      const publishCmd = {
        scope,
        name,
        version,
        description,
        packageJson: item,
        readme,
        registryId: registry?.registryId,
        dist: {
          localFile,
        },
        isPrivate: false,
        publishTime,
        skipRefreshPackageManifests: true,
      };
      try {
        // 当 version 记录已经存在时，还需要校验一下 pkg.manifests 是否存在
        const publisher = users.find(user => user.displayName === item._npmUser?.name) || users[0];
        const pkgVersion = await this.packageManagerService.publish(publishCmd, publisher);
        updateVersions.push(pkgVersion.version);
        logs.push(`[${isoNow()}] 🟢 [${syncIndex}] Synced version ${version} success, packageVersionId: ${pkgVersion.packageVersionId}, db id: ${pkgVersion.id}`);
      } catch (err: any) {
        if (err.name === 'ForbiddenError') {
          logs.push(`[${isoNow()}] 🐛 [${syncIndex}] Synced version ${version} already exists, skip publish, try to set in local manifest`);
          // 如果 pkg.manifests 不存在，需要补充一下
          updateVersions.push(version);
        } else {
          err.taskId = task.taskId;
          this.logger.error(err);
          lastErrorMessage = `publish error: ${err}`;
          logs.push(`[${isoNow()}] ❌ [${syncIndex}] Synced version ${version} error, ${lastErrorMessage}`);
        }
      }
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      logs = [];
      await rm(localFile, { force: true });
      if (!skipDependencies) {
        const dependencies: Record<string, string> = item.dependencies || {};
        for (const dependencyName in dependencies) {
          dependenciesSet.add(dependencyName);
        }
        const optionalDependencies: Record<string, string> = item.optionalDependencies || {};
        for (const dependencyName in optionalDependencies) {
          dependenciesSet.add(dependencyName);
        }
      }
    }
    // try to read package entity again after first sync
    if (!pkg) {
      pkg = await this.packageRepository.findPackage(scope, name);
    }
    if (!pkg || !pkg.id) {
      // sync all versions fail in the first time
      logs.push(`[${isoNow()}] ❌ All versions sync fail, package not exists, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ${failEnd}`);
      task.error = lastErrorMessage;
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[PackageSyncerService.executeTask:fail] taskId: %s, targetName: %s, package not exists',
        task.taskId, task.targetName);
      return;
    }

    // 2.1 save differentMetas
    for (const [ existsItem, diffMeta ] of differentMetas) {
      const pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, existsItem.version);
      if (pkgVersion) {
        await this.packageManagerService.savePackageVersionManifest(pkgVersion, diffMeta, diffMeta);
        updateVersions.push(pkgVersion.version);
        let diffMetaInfo = JSON.stringify(diffMeta);
        if ('readme' in diffMeta) {
          diffMetaInfo += ', delete exists readme';
        }
        logs.push(`[${isoNow()}] 🟢 Synced version ${existsItem.version} success, different meta: ${diffMetaInfo}`);
      }
    }

    const removeVersions: string[] = [];
    // 2.3 find out remove versions
    for (const existsVersion in existsVersionMap) {
      if (!(existsVersion in versionMap)) {
        const pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, existsVersion);
        if (pkgVersion) {
          await this.packageManagerService.removePackageVersion(pkg, pkgVersion, true);
          logs.push(`[${isoNow()}] 🟢 Removed version ${existsVersion} success`);
        }
        removeVersions.push(existsVersion);
      }
    }

    logs.push(`[${isoNow()}] 🟢 Synced updated ${updateVersions.length} versions, removed ${removeVersions.length} versions`);
    if (updateVersions.length > 0 || removeVersions.length > 0) {
      logs.push(`[${isoNow()}] 🚧 Refreshing manifests to dists ......`);
      const start = Date.now();
      await this.taskService.appendTaskLog(task, logs.join('\n'));
      logs = [];
      await this.packageManagerService.refreshPackageChangeVersionsToDists(pkg, updateVersions, removeVersions);
      logs.push(`[${isoNow()}] 🟢 Refresh use ${Date.now() - start}ms`);
    }

    // 3. update tags
    // "dist-tags": {
    //   "latest": "0.0.7"
    // },
    const changedTags: { tag: string, version?: string, action: string }[] = [];
    const existsDistTags = existsData && existsData['dist-tags'] || {};
    let shouldRefreshDistTags = false;
    for (const tag in distTags) {
      const version = distTags[tag];
      const utf8mb3Regex = /[\u0020-\uD7FF\uE000-\uFFFD]/;
      if (!utf8mb3Regex.test(tag)) {
        logs.push(`[${isoNow()}] 🚧 invalid tag(${tag}: ${version}), tag name is out of utf8mb3, skip`);
        continue;
      }
      // 新 tag 指向的版本既不在存量数据里，也不在本次同步版本列表里
      // 例如 latest 对应的 version 写入失败跳过
      if (!existsVersionMap[version] && !updateVersions.includes(version)) {
        logs.push(`[${isoNow()}] 🚧 invalid tag(${tag}: ${version}), version is not exists, skip`);
        continue;
      }
      const changed = await this.packageManagerService.savePackageTag(pkg, tag, version);
      if (changed) {
        changedTags.push({ action: 'change', tag, version });
        shouldRefreshDistTags = false;
      } else if (version !== existsDistTags[tag]) {
        shouldRefreshDistTags = true;
        logs.push(`[${isoNow()}] 🚧 Remote tag(${tag}: ${version}) not exists in local dist-tags`);
      }
    }
    // 3.1 find out remove tags
    for (const tag in existsDistTags) {
      if (!(tag in distTags)) {
        const changed = await this.packageManagerService.removePackageTag(pkg, tag);
        if (changed) {
          changedTags.push({ action: 'remove', tag });
          shouldRefreshDistTags = false;
        }
      }
    }
    // 3.2 shoud add latest tag
    // 在同步 sepcific version 时如果没有同步 latestTag 的版本会出现 latestTag 丢失或指向版本不正确的情况
    if (specificVersions && this.config.cnpmcore.strictSyncSpecivicVersion) {
      // 不允许自动同步 latest 版本，从已同步版本中选出 latest
      let latestStableVersion: string;
      const sortedVersionList = specificVersions.sort(semverRcompare);
      latestStableVersion = sortedVersionList.filter(i => !semverPrerelease(i))[0];
      // 所有版本都不是稳定版本则指向非稳定版本保证 latest 存在
      if (!latestStableVersion) {
        latestStableVersion = sortedVersionList[0];
      }
      if (!existsDistTags.latest || semverRcompare(existsDistTags.latest, latestStableVersion) === 1) {
        logs.push(`[${isoNow()}] 🚧 patch latest tag from specific versions 🚧`);
        changedTags.push({ action: 'change', tag: 'latest', version: latestStableVersion });
        await this.packageManagerService.savePackageTag(pkg, 'latest', latestStableVersion);
      }
    }

    if (changedTags.length > 0) {
      logs.push(`[${isoNow()}] 🟢 Synced ${changedTags.length} tags: ${JSON.stringify(changedTags)}`);
    }
    if (shouldRefreshDistTags) {
      await this.packageManagerService.refreshPackageDistTagsToDists(pkg);
      logs.push(`[${isoNow()}] 🟢 Refresh dist-tags`);
    }

    // 4. add package maintainers
    await this.packageManagerService.savePackageMaintainers(pkg, users);
    // 4.1 find out remove maintainers
    const removedMaintainers: unknown[] = [];
    const existsMaintainers = existsData && existsData.maintainers || [];
    for (const maintainer of existsMaintainers) {
      const { name } = maintainer;
      if (!(name in maintainersMap)) {
        const user = await this.userRepository.findUserByName(`${registry?.userPrefix || 'npm:'}${name}`);
        if (user) {
          await this.packageManagerService.removePackageMaintainer(pkg, user);
          removedMaintainers.push(maintainer);
        }
      }
    }
    if (removedMaintainers.length > 0) {
      logs.push(`[${isoNow()}] 🟢 Removed ${removedMaintainers.length} maintainers: ${JSON.stringify(removedMaintainers)}`);
    }

    // 4.2 update package maintainers in dist
    // The event is initialized in the repository and distributed after uncork.
    // maintainers' information is updated in bulk to ensure consistency.
    if (!isEqual(maintainers, existsMaintainers)) {
      logs.push(`[${isoNow()}] 🚧 Syncing maintainers to package manifest, from: ${JSON.stringify(maintainers)} to: ${JSON.stringify(existsMaintainers)}`);
      await this.packageManagerService.refreshPackageMaintainersToDists(pkg);
      logs.push(`[${isoNow()}] 🟢 Syncing maintainers to package manifest done`);
    }

    // 5. add deps sync task
    for (const dependencyName of dependenciesSet) {
      const existsTask = await this.taskRepository.findTaskByTargetName(dependencyName, TaskType.SyncPackage, TaskState.Waiting);
      if (existsTask) {
        logs.push(`[${isoNow()}] 📖 Has dependency "${dependencyName}" sync task: ${existsTask.taskId}, db id: ${existsTask.id}`);
        continue;
      }
      const tips = `Sync cause by "${fullname}" dependencies, parent task: ${task.taskId}`;
      const dependencyTask = await this.createTask(dependencyName, {
        authorId: task.authorId,
        authorIp: task.authorIp,
        tips,
        remoteAuthToken,
      });
      logs.push(`[${isoNow()}] 📦 Add dependency "${dependencyName}" sync task: ${dependencyTask.taskId}, db id: ${dependencyTask.id}`);
    }

    if (syncDownloadData) {
      await this.syncDownloadData(task, pkg);
    }

    // clean cache
    await this.cacheService.removeCache(fullname);
    logs.push(`[${isoNow()}] 🟢 Clean cache`);
    logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
    logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${url} 🟢🟢🟢🟢🟢`);
    task.error = lastErrorMessage;
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
    this.logger.info('[PackageSyncerService.executeTask:success] taskId: %s, targetName: %s',
      task.taskId, task.targetName);
  }
}
