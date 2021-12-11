import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { rm } from 'fs/promises';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { NPMRegistry } from '../../common/adapter/NPMRegistry';
import { getScopeAndName } from '../../common/PackageUtil';
import { TaskState, TaskType } from '../../common/enum/Task';
import { TaskRepository } from '../../repository/TaskRepository';
import { PackageRepository } from '../../repository/PackageRepository';
import { Task, SyncPackageParams } from '../entity/Task';
import { AbstractService } from './AbstractService';
import { UserService } from './UserService';
import { PackageManagerService } from './PackageManagerService';
import { User } from '../entity/User';

function isoNow() {
  return new Date().toISOString();
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
  private readonly nfsAdapter: NFSAdapter;
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly userService: UserService;
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  public async createTask(fullname: string, ip: string, userId: string) {
    const task = Task.createSyncPackage(fullname, { authorId: userId, authorIp: ip });
    await this.taskRepository.saveTask(task);
    return task;
  }

  public async findTask(taskId: string) {
    const task = await this.taskRepository.findTask(taskId);
    return task;
  }

  public async findTaskLog(task: Task) {
    return await this.nfsAdapter.getDownloadUrlOrStream(task.logPath);
  }

  public async findExecuteTask() {
    const task = await this.taskRepository.executeWaitingTask(TaskType.SyncPackage);
    if (task && task.attempts > 3) {
      task.state = TaskState.Timeout;
      task.attempts -= 1;
      await this.taskRepository.saveTaskToHistory(task);
      return null;
    }
    return task;
  }

  public async executeTask(task: Task, syncDependencies = true) {
    const { fullname } = task.data as SyncPackageParams;
    let logs: string[] = [];
    if (this.config.cnpmcore.sourceRegistryIsCNpm) {
      logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Waiting upstream sync "${fullname}" task on ${this.npmRegistry.registry} 🚧🚧🚧🚧🚧`);
      // create sync task on sourceRegistry
      const upstreamTaskLogUrl = '';
      logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${upstreamTaskLogUrl} 🟢🟢🟢🟢🟢`);
    }
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start sync "${fullname}" from ${this.npmRegistry.registry} 🚧🚧🚧🚧🚧`);
    let result;
    try {
      result = await this.npmRegistry.getFullManifests(fullname);
    } catch (err: any) {
      const status = err.status || 'unknow';
      logs.push(`[${isoNow()}] ❌ Synced ${fullname} fail, request manifests error: ${err}, status: ${status}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname} ❌❌❌❌❌`);
      await this.finishTask(task, TaskState.Fail, logs.join('\n'));
      return;
    }
    const { url, data, headers, res, status } = result;
    const readme: string = data.readme;
    const failEnd = `❌❌❌❌❌ ${url} ❌❌❌❌❌`;
    logs.push(`[${isoNow()}] HTTP [${status}] content-length: ${headers['content-length']}, timing: ${JSON.stringify(res.timing)}`);

    // 1. save maintainers
    // maintainers: [
    //   { name: 'bomsy', email: 'b4bomsy@gmail.com' },
    //   { name: 'jasonlaster11', email: 'jason.laster.11@gmail.com' }
    // ],
    const maintainers = data.maintainers;
    const users: User[] = [];
    if (Array.isArray(maintainers) && maintainers.length > 0) {
      logs.push(`[${isoNow()}] Syncing maintainers: ${JSON.stringify(maintainers)}`);
      for (const maintainer of maintainers) {
        if (maintainer.name && maintainer.email) {
          const user = await this.userService.savePublicUser(maintainer.name, maintainer.email);
          users.push(user);
          logs.push(`[${isoNow()}] Synced ${maintainer.name} => ${user.name}(${user.userId})`);
        }
      }
    }

    if (users.length === 0) {
      // invalid maintainers, sync fail
      logs.push(`[${isoNow()}] Invalid maintainers: ${JSON.stringify(maintainers)}`);
      logs.push(`[${isoNow()}] ${failEnd}`);
      await this.finishTask(task, TaskState.Fail, logs.join('\n'));
      return;
    }

    const dependenciesSet = new Set<string>();

    const [ scope, name ] = getScopeAndName(fullname);
    const { data: existsData } = await this.packageManagerService.listPackageFullManifests(scope, name, undefined);
    const existsVersionMap = existsData && existsData.versions || {};
    const existsVersionCount = Object.keys(existsVersionMap).length;
    // 2. save versions
    const versions = Object.values<any>(data.versions || {});
    logs.push(`[${isoNow()}] Syncing versions ${existsVersionCount} => ${versions.length}`);
    let syncVersionCount = 0;
    for (const item of versions) {
      const version: string = item.version;
      if (version && existsVersionMap[version]) continue;
      const description: string = item.description;
      // "dist": {
      //   "shasum": "943e0ec03df00ebeb6273a5b94b916ba54b47581",
      //   "tarball": "https://registry.npmjs.org/foo/-/foo-1.0.0.tgz"
      // },
      const dist = item.dist;
      const tarball: string = dist && dist.tarball;
      if (!tarball) {
        logs.push(`[${isoNow()}] ❌ Synced version ${version} fail, missing tarball, dist: ${JSON.stringify(dist)}`);
        await this.appendTaskLog(task, logs.join('\n'));
        logs = [];
        continue;
      }
      logs.push(`[${isoNow()}] 🚧 Syncing version ${version}, tarball: ${tarball}`);
      let localFile: string;
      try {
        const { tmpfile, status, headers, res } = await this.npmRegistry.downloadTarball(tarball);
        localFile = tmpfile;
        logs.push(`[${isoNow()}] HTTP [${status}] content-length: ${headers['content-length']}, timing: ${JSON.stringify(res.timing)} => ${localFile}`);
        if (status !== 200) {
          logs.push(`[${isoNow()}] ❌ Synced version ${version} fail, download tarball status error: ${status}`);
          await this.appendTaskLog(task, logs.join('\n'));
          logs = [];
          if (localFile) {
            await rm(localFile, { force: true });
          }
          continue;
        }
      } catch (err: any) {
        const status = err.status || 'unknow';
        logs.push(`[${isoNow()}] ❌ Synced version ${version} fail, download tarball error: ${err}, status: ${status}`);
        await this.appendTaskLog(task, logs.join('\n'));
        logs = [];
        continue;
      }
      const pkgVersion = await this.packageManagerService.publish({
        scope,
        name,
        version,
        description,
        packageJson: item,
        readme,
        dist: {
          localFile,
        },
        isPrivate: false,
      }, users[0]);
      syncVersionCount++;
      logs.push(`[${isoNow()}] 🟢 Synced version ${version} success, packageVersionId: ${pkgVersion.packageVersionId}, db id: ${pkgVersion.id}`);
      await this.appendTaskLog(task, logs.join('\n'));
      logs = [];
      await rm(localFile, { force: true });
      if (syncDependencies) {
        const dependencies = item.dependencies || {};
        for (const dependencyName in dependencies) {
          dependenciesSet.add(dependencyName);
        }
      }
      // 2.1 save deprecated
    }
    logs.push(`[${isoNow()}] Synced ${syncVersionCount} versions`);

    // 3. update tags
    // "dist-tags": {
    //   "latest": "0.0.7"
    // },
    const distTags = data['dist-tags'] || {};
    const pkg = await this.packageRepository.findPackage(scope, name);
    for (const tag in distTags) {
      const version = distTags[tag];
      await this.packageManagerService.savePackageTag(pkg!, tag, version);
    }
    logs.push(`[${isoNow()}] 🟢 Synced tags: ${JSON.stringify(distTags)}`);

    // 4. add package maintainers
    for (const user of users) {
      await this.packageManagerService.savePackageMaintainer(pkg!, user);
    }

    // 5. add deps sync task
    for (const dependencyName of dependenciesSet) {
      const dependencyTask = await this.createTask(dependencyName, task.authorId, task.authorIp);
      logs.push(`[${isoNow()}] Add dependency ${dependencyName} sync task: ${dependencyTask.taskId}, db id: ${dependencyTask.id}`);
    }
    logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 ${url} 🟢🟢🟢🟢🟢`);
    await this.finishTask(task, TaskState.Success, logs.join('\n'));
  }

  private async appendTaskLog(task: Task, appendLog: string) {
    // console.log(appendLog);
    await this.nfsAdapter.appendBytes(task.logPath, Buffer.from(appendLog + '\n'));
    task.updatedAt = new Date();
    await this.taskRepository.saveTask(task);
  }

  private async finishTask(task: Task, taskState: TaskState, appendLog: string) {
    // console.log(appendLog);
    await this.nfsAdapter.appendBytes(task.logPath, Buffer.from(appendLog + '\n'));
    task.state = taskState;
    await this.taskRepository.saveTaskToHistory(task);
  }
}
