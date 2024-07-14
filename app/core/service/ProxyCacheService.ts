import { InternalServerError, ForbiddenError, HttpError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { EggHttpClient } from 'egg';
import { downloadToTempfile } from '../../common/FileUtil';
import { NPMRegistry } from '../../common/adapter/NPMRegistry';
import { ProxyCache } from '../entity/ProxyCache';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
// import { TaskRepository } from '../../repository/TaskRepository';
import { AbstractService } from '../../common/AbstractService';
import { TaskService } from './TaskService';
import { readFile, rm } from 'node:fs/promises';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { PROXY_MODE_CACHED_PACKAGE_DIR_NAME } from '../../common/constants';
import { DIST_NAMES } from '../entity/Package';
import type { AbbreviatedPackageManifestType, AbbreviatedPackageJSONType, PackageManifestType, PackageJSONType } from '../../repository/PackageRepository';
import { TaskType, TaskState } from '../../common/enum/Task';
import { Task, UpdateProxyCacheTaskOptions, CreateUpdateProxyCacheTask } from '../entity/Task';

function isoNow() {
  return new Date().toISOString();
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyCacheService extends AbstractService {
  @Inject()
  private readonly httpclient: EggHttpClient;
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;
  @Inject()
  private readonly proxyCacheRepository: ProxyCacheRepository;
  @Inject()
  private readonly taskService: TaskService;

  async getPackageVersionTarAndTempFilePath(fullname: string, url: string): Promise<{ tgzBuffer:Buffer| null }> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      throw new ForbiddenError(`stop proxy by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`);
    }
    const requestTgzURL = `${this.npmRegistry.registry}/${url}`;
    const { tmpfile } = await downloadToTempfile(this.httpclient, this.config.dataDir, requestTgzURL);
    const tgzBuffer = await readFile(tmpfile);
    await rm(tmpfile, { force: true });
    return { tgzBuffer };
  }

  // used by GET /:fullname/:versionOrTag
  async getPackageVersionManifest(fullname: string, fileType: DIST_NAMES, versionOrTag: string): Promise<PackageJSONType> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      const error = `stop cache by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`;
      this.logger.info('[ProxyCacheService.cacheManifests:fail-block-list] targetName: %s, %s',
        fullname, error);
      throw new ForbiddenError('this package is in block list');
    }
    const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType, versionOrTag))?.filePath;
    if (cachedStoreKey) {
      const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
      if (nfsBytes) {
        try {
          const decoder = new TextDecoder();
          const nfsString = decoder.decode(nfsBytes);
          return JSON.parse(nfsString) as PackageJSONType;
        } catch {
          // JSON parse error
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
          throw new InternalServerError('manifest in NFS JSON parse error');
        }
      }
    }
    const { storeKey, manifest } = await this.getSourceManifestAndCache(fullname, fileType, versionOrTag);
    const cachedFiles = await ProxyCache.create({ fullname, fileType, filePath: storeKey });
    this.proxyCacheRepository.saveProxyCache(cachedFiles);
    return manifest;
  }

  async getPackageManifest(fullname: string, fileType: DIST_NAMES): Promise<AbbreviatedPackageJSONType|AbbreviatedPackageManifestType|PackageJSONType|PackageManifestType> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      const error = `stop cache by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`;
      this.logger.info('[ProxyCacheService.cacheManifests:fail-block-list] targetName: %s, %s',
        fullname, error);
      throw new ForbiddenError('this package is in block list');
    }
    const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType))?.filePath;
    if (cachedStoreKey) {
      const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
      if (nfsBytes) {
        let nfsPkgManifgest :PackageJSONType;
        try {
          const decoder = new TextDecoder();
          const nfsString = decoder.decode(nfsBytes);
          nfsPkgManifgest = JSON.parse(nfsString);
        } catch {
          // JSON parse error
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
          throw new InternalServerError('manifest in NFS JSON parse error');
        }
        return nfsPkgManifgest;
      }
    }

    const { storeKey, manifest } = await this.getSourceManifestAndCache(fullname, fileType);
    const cachedFiles = await ProxyCache.create({ fullname, fileType, filePath: storeKey });
    this.proxyCacheRepository.saveProxyCache(cachedFiles);
    return manifest;
  }

  async getSourceManifestAndCache(fullname:string, fileType: DIST_NAMES, versionOrTag?:string): Promise<{ storeKey: string, proxyBytes: Buffer, manifest: PackageJSONType }> {
    let responseResult;
    switch (fileType) {
      case DIST_NAMES.FULL_MANIFESTS:
        responseResult = await this.npmRegistry.getFullManifests(fullname);
        break;
      case DIST_NAMES.ABBREVIATED_MANIFESTS:
        responseResult = await this.npmRegistry.getAbbreviatedManifests(fullname);
        break;
      case DIST_NAMES.MANIFEST:
        responseResult = await this.npmRegistry.getPackageVersionManifest(fullname, versionOrTag!);
        break;
      case DIST_NAMES.ABBREVIATED:
        responseResult = await this.npmRegistry.getAbbreviatedPackageVersionManifest(fullname, versionOrTag!);
        break;
      default:
        break;
    }
    if (responseResult.status !== 200) {
      throw new HttpError({
        status: responseResult.status,
        message: responseResult.data?.error || responseResult.statusText,
      });
    }

    // replace tarball url
    const manifest = responseResult.data;
    const { sourceRegistry, registry } = this.config.cnpmcore;
    if (fileType === DIST_NAMES.FULL_MANIFESTS || fileType === DIST_NAMES.ABBREVIATED) {
      // pkg manifest
      const versionMap = manifest.versions || {};
      for (const key in versionMap) {
        const versionItem = versionMap[key];
        if (versionItem?.dist?.tarball) {
          versionItem.dist.tarball = versionItem.dist.tarball.replace(sourceRegistry, registry);
        }
      }
    } else {
      // pkg version manifest
      const distItem = manifest.dist || {};
      if (distItem.tarball) {
        distItem.tarball = distItem.tarball.replace(sourceRegistry, registry);
      }
    }
    const proxyBytes = Buffer.from(JSON.stringify(manifest));
    const storeKey = `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/${fullname}/${fileType}`;
    await this.nfsAdapter.uploadBytes(storeKey, proxyBytes);
    return { storeKey, proxyBytes, manifest };
  }

  public async createTask(targetName: string, options: UpdateProxyCacheTaskOptions): Promise<CreateUpdateProxyCacheTask> {
    return await this.taskService.createTask(Task.createUpdateProxyCache(targetName, options), false) as CreateUpdateProxyCacheTask;
  }

  public async findTask(taskId: string) {
    return await this.taskService.findTask(taskId);
  }

  public async findTaskLog(task: Task) {
    return await this.taskService.findTaskLog(task);
  }

  public async findExecuteTask() {
    return await this.taskService.findExecuteTask(TaskType.UpdateProxyCache);
  }

  public async executeTask(task: Task) {
    const logs: string[] = [];
    const fullname = (task as CreateUpdateProxyCacheTask).data.fullname;
    const { fileType, version } = (task as CreateUpdateProxyCacheTask).data;
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start update "${fullname}-${fileType}" 🚧🚧🚧🚧🚧`);
    try {
      if (fileType === DIST_NAMES.ABBREVIATED_MANIFESTS || fileType === DIST_NAMES.FULL_MANIFESTS) {
        await this.getSourceManifestAndCache(fullname, fileType);
      } else {
        task.error = 'Unacceptable file type.';
        logs.push(`[${isoNow()}] ❌ ${task.error}`);
        logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname}-${fileType} ${version} ❌❌❌❌❌`);
        await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
        this.logger.info('[ProxyCacheService.executeTask:fail] taskId: %s, targetName: %s, %s',
          task.taskId, task.targetName, task.error);
        return;
      }
    } catch (error) {
      task.error = error;
      logs.push(`[${isoNow()}] ❌ ${task.error}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname}-${fileType} ${version} ❌❌❌❌❌`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[ProxyCacheService.executeTask:fail] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      return;
    }
    logs.push(`[${isoNow()}] 🟢 Update Success.`);
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
  }

}
