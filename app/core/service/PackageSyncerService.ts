import os from 'os';
import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import {
  EggContextHttpClient,
} from 'egg';
import { setTimeout } from 'timers/promises';
import { rm } from 'fs/promises';
import { NPMRegistry } from '../../common/adapter/NPMRegistry';
import { detectInstallScript, getScopeAndName } from '../../common/PackageUtil';
import { downloadToTempfile } from '../../common/FileUtil';
import { TaskState, TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { PackageRepository } from '../../repository/PackageRepository';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { UserRepository } from '../../repository/UserRepository';
import { DistRepository } from '../../repository/DistRepository';
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

function isoNow() {
  return new Date().toISOString();
}

export class RegistryNotMatchError extends BadRequestError {
}

@ContextProto({
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
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private readonly distRepository: DistRepository;
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
      const { data, status, res } = await this.npmRegistry.getDownloadRanges(registry, fullname, start, end);
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
    let logs: string[] = [];
    let logId = '';
    logs.push(`[${isoNow()}][UP] 🚧🚧🚧🚧🚧 Waiting sync "${fullname}" task on ${registry} 🚧🚧🚧🚧🚧`);
    const failEnd = `❌❌❌❌❌ Sync ${registry}/${fullname} 🚮 give up 🚮 ❌❌❌❌❌`;
    try {
      const { data, status, res } = await this.npmRegistry.createSyncTask(fullname);
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
        const { data, status, url } = await this.npmRegistry.getSyncTask(fullname, logId, offset);
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

  // 初始化对应的 Registry
  // 1. 优先从 pkg.registryId 获取 (registryId 一经设置 不应改变)
  // 1. 其次从 task.data.registryId (创建单包同步任务时传入)
  // 2. 接着根据 scope 进行计算 (作为子包依赖同步时候，无 registryId)
  // 3. 最后返回 default registryId (可能 default registry 也不存在)
  public async initSpecRegistry(task: Task, pkg: Package | null = null): Promise<Registry | null> {
    const registryId = pkg?.registryId || (task.data as SyncPackageTaskOptions).registryId;
    let targetHost: string = this.config.cnpmcore.sourceRegistry;
    let registry: Registry | null = null;

    // 当前任务作为 deps 引入时，不会配置 registryId
    // 历史 Task 可能没有配置 registryId
    if (registryId) {
      registry = await this.registryManagerService.findByRegistryId(registryId);
    } else if (pkg?.scope) {
      const scopeModel = await this.scopeManagerService.findByName(pkg?.scope);
      if (scopeModel?.registryId) {
        registry = await this.registryManagerService.findByRegistryId(scopeModel?.registryId);
      }
    }

    // 采用默认的 registry
    if (!registry) {
      registry = await this.registryManagerService.findByRegistryName('default');
    }

    // 更新 targetHost 地址
    // defaultRegistry 可能还未创建
    if (registry?.host) {
      targetHost = registry.host;
    }
    this.npmRegistry.setRegistryHost(targetHost);
    return registry;
  }

  public async executeTask(task: Task) {
    const fullname = task.targetName;
    const [ scope, name ] = getScopeAndName(fullname);
    const { tips, skipDependencies: originSkipDependencies, syncDownloadData, forceSyncHistory } = task.data as SyncPackageTaskOptions;
    let pkg = await this.packageRepository.findPackage(scope, name);
    const registry = await this.initSpecRegistry(task, pkg);
    const registryHost = this.npmRegistry.registry;
    let logs: string[] = [];
    if (tips) {
      logs.push(`[${isoNow()}] 👉👉👉👉👉 Tips: ${tips} 👈👈👈👈👈`);
    }
    const taskQueueLength = await this.taskService.getTaskQueueLength(task.type);
    const taskQueueHighWaterSize = this.config.cnpmcore.taskQueueHighWaterSize;
    const taskQueueInHighWaterState = taskQueueLength >= taskQueueHighWaterSize;
    const skipDependencies = taskQueueInHighWaterState ? true : !!originSkipDependencies;
    const syncUpstream = !!(!taskQueueInHighWaterState && this.config.cnpmcore.sourceRegistryIsCNpm && this.config.cnpmcore.syncUpstreamFirst);
    const logUrl = `${this.config.cnpmcore.registry}/-/package/${fullname}/syncs/${task.taskId}/log`;
    this.logger.info('[PackageSyncerService.executeTask:start] taskId: %s, targetName: %s, attempts: %s, taskQueue: %s/%s, syncUpstream: %s, log: %s',
      task.taskId, task.targetName, task.attempts, taskQueueLength, taskQueueHighWaterSize, syncUpstream, logUrl);
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Syncing from ${registryHost}/${fullname}, skipDependencies: ${skipDependencies}, syncUpstream: ${syncUpstream}, syncDownloadData: ${!!syncDownloadData}, forceSyncHistory: ${!!forceSyncHistory} attempts: ${task.attempts}, worker: "${os.hostname()}/${process.pid}", taskQueue: ${taskQueueLength}/${taskQueueHighWaterSize} 🚧🚧🚧🚧🚧`);
    logs.push(`[${isoNow()}] 🚧 log: ${logUrl}`);

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

    let result: any;
    try {
      result = await this.npmRegistry.getFullManifests(fullname);
    } catch (err: any) {
      const status = err.status || 'unknow';
      task.error = `request manifests error: ${err}, status: ${status}`;
      logs.push(`[${isoNow()}] ❌ Synced ${fullname} fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} ❌❌❌❌❌`);
      this.logger.info('[PackageSyncerService.executeTask:fail-request-error] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      await this.taskService.retryTask(task, logs.join('\n'));
      return;
    }

    const { url, data, headers, res, status } = result;
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

    if (status === 404) {
      if (pkg) {
        await this.packageManagerService.unpublishPackage(pkg);
        logs.push(`[${isoNow()}] 🟢 Package "${fullname}" was unpublished caused by 404 response: ${JSON.stringify(data)}`);
        logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
        logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${url} 🟢🟢🟢🟢🟢`);
        await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
        this.logger.info('[PackageSyncerService.executeTask:remove-package] taskId: %s, targetName: %s',
          task.taskId, task.targetName);
      } else {
        task.error = `Package not exists, response data: ${JSON.stringify(data)}`;
        logs.push(`[${isoNow()}] ❌ ${task.error}, log: ${logUrl}`);
        logs.push(`[${isoNow()}] ${failEnd}`);
        await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
        this.logger.info('[PackageSyncerService.executeTask:fail-404] taskId: %s, targetName: %s, %s',
          task.taskId, task.targetName, task.error);
      }
      return;
    }

    const versionMap = data.versions || {};
    const distTags = data['dist-tags'] || {};

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
      if (timeMap.unpublished) {
        if (pkg) {
          await this.packageManagerService.unpublishPackage(pkg);
          logs.push(`[${isoNow()}] 🟢 Sync unpublished package: ${JSON.stringify(timeMap.unpublished)} success`);
        } else {
          logs.push(`[${isoNow()}] 📖 Ignore unpublished package: ${JSON.stringify(timeMap.unpublished)}`);
        }
        logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
        logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${url} 🟢🟢🟢🟢🟢`);
        await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
        this.logger.info('[PackageSyncerService.executeTask:success] taskId: %s, targetName: %s',
          task.taskId, task.targetName);
        return;
      }

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
    const versions = Object.values<any>(versionMap);
    logs.push(`[${isoNow()}] 🚧 Syncing versions ${existsVersionCount} => ${versions.length}`);
    const updateVersions: string[] = [];
    const differentMetas: any[] = [];
    let syncIndex = 0;
    for (const item of versions) {
      const version: string = item.version;
      if (!version) continue;
      let existsItem = existsVersionMap[version];
      let existsAbbreviatedItem = abbreviatedVersionMap[version];
      const shouldDeleteReadme = !!(existsItem && 'readme' in existsItem);
      if (pkg) {
        if (existsItem) {
          // check item on AbbreviatedManifests
          if (!existsAbbreviatedItem) {
            updateVersions.push(version);
            logs.push(`[${isoNow()}] 🐛 Remote version ${version} not exists on local abbreviated manifests, need to refresh`);
          }
        } else {
          // try to read from db detect if last sync interrupt before refreshPackageManifestsToDists() be called
          existsItem = await this.distRepository.findPackageVersionManifest(pkg.packageId, version);
          // only allow existsItem on db to force refresh, to avoid big versions fresh
          // see https://r.cnpmjs.org/-/package/@npm-torg/public-scoped-free-org-test-package-2/syncs/61fcc7e8c1646e26a845b674/log
          if (existsItem) {
            // version not exists on manifests, need to refresh
            // bugfix: https://github.com/cnpm/cnpmcore/issues/115
            updateVersions.push(version);
            logs.push(`[${isoNow()}] 🐛 Remote version ${version} not exists on local manifests, need to refresh`);
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
        const metaDataKeys = [
          'peerDependenciesMeta', 'os', 'cpu', 'libc', 'workspaces', 'hasInstallScript', 'deprecated',
        ];
        let diffMeta: any;
        for (const key of metaDataKeys) {
          let remoteItemValue = item[key];
          // make sure hasInstallScript exists
          if (key === 'hasInstallScript' && remoteItemValue === undefined) {
            if (detectInstallScript(item)) {
              remoteItemValue = true;
            }
          }
          const remoteItemDiffValue = JSON.stringify(remoteItemValue);
          if (remoteItemDiffValue !== JSON.stringify(existsItem[key])) {
            if (!diffMeta) diffMeta = {};
            diffMeta[key] = remoteItemValue;
          } else if (existsAbbreviatedItem && remoteItemDiffValue !== JSON.stringify(existsAbbreviatedItem[key])) {
            // should diff exists abbreviated item too
            if (!diffMeta) diffMeta = {};
            diffMeta[key] = remoteItemValue;
          }
        }
        // should delete readme
        if (shouldDeleteReadme) {
          if (!diffMeta) diffMeta = {};
          diffMeta.readme = undefined;
        }
        if (diffMeta) {
          differentMetas.push([ existsItem, diffMeta ]);
        }
        continue;
      }
      syncIndex++;
      const description: string = item.description;
      // "dist": {
      //   "shasum": "943e0ec03df00ebeb6273a5b94b916ba54b47581",
      //   "tarball": "https://registry.npmjs.org/foo/-/foo-1.0.0.tgz"
      // },
      const dist = item.dist;
      const tarball: string = dist && dist.tarball;
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
          await downloadToTempfile(this.httpclient, this.config.dataDir, tarball);
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
      if (pkg) {
        // check again, make sure prefix version not exists
        const existsPkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
        if (existsPkgVersion) {
          await rm(localFile, { force: true });
          logs.push(`[${isoNow()}] 🐛 [${syncIndex}] Synced version ${version} already exists, skip publish it`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          continue;
        }
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
        const pkgVersion = await this.packageManagerService.publish(publishCmd, users[0]);
        updateVersions.push(pkgVersion.version);
        logs.push(`[${isoNow()}] 🟢 [${syncIndex}] Synced version ${version} success, packageVersionId: ${pkgVersion.packageVersionId}, db id: ${pkgVersion.id}`);
      } catch (err: any) {
        if (err.name === 'ForbiddenError') {
          logs.push(`[${isoNow()}] 🐛 [${syncIndex}] Synced version ${version} already exists, skip publish error`);
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
        const dependencies = item.dependencies || {};
        for (const dependencyName in dependencies) {
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
    let shouldRefreshMaintainers = false;
    for (const maintainer of existsMaintainers) {
      let npmUserName = maintainer.name;
      if (npmUserName.startsWith('npm:')) {
        // fix cache npm user name
        npmUserName = npmUserName.replace('npm:', '');
        shouldRefreshMaintainers = true;
      }
      if (!(npmUserName in maintainersMap)) {
        const user = await this.userRepository.findUserByName(`npm:${npmUserName}`);
        if (user) {
          await this.packageManagerService.removePackageMaintainer(pkg, user);
          removedMaintainers.push(maintainer);
        }
      }
    }
    if (removedMaintainers.length > 0) {
      logs.push(`[${isoNow()}] 🟢 Removed ${removedMaintainers.length} maintainers: ${JSON.stringify(removedMaintainers)}`);
    } else if (shouldRefreshMaintainers) {
      await this.packageManagerService.refreshPackageMaintainersToDists(pkg);
      logs.push(`[${isoNow()}] 🟢 Refresh maintainers`);
    }

    // 5. add deps sync task
    for (const dependencyName of dependenciesSet) {
      const existsTask = await this.taskRepository.findTaskByTargetName(fullname, TaskType.SyncPackage, TaskState.Waiting);
      if (existsTask) {
        logs.push(`[${isoNow()}] 📖 Has dependency "${dependencyName}" sync task: ${existsTask.taskId}, db id: ${existsTask.id}`);
        continue;
      }
      const tips = `Sync cause by "${fullname}" dependencies, parent task: ${task.taskId}`;
      const dependencyTask = await this.createTask(dependencyName, {
        authorId: task.authorId,
        authorIp: task.authorIp,
        tips,
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
