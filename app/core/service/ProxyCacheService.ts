import { InternalServerError, HttpError, NotFoundError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { BackgroundTaskHelper } from '@eggjs/tegg-background-task';
import { valid as semverValid } from 'semver';
import { AbstractService } from '../../common/AbstractService';
import { TaskService } from './TaskService';
import { CacheService } from './CacheService';
import { NPMRegistry } from '../../common/adapter/NPMRegistry';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { ProxyCache } from '../entity/ProxyCache';
import { Task, UpdateProxyCacheTaskOptions, CreateUpdateProxyCacheTask } from '../entity/Task';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { TaskType, TaskState } from '../../common/enum/Task';
import { calculateIntegrity } from '../../common/PackageUtil';
import { DIST_NAMES } from '../entity/Package';
import { PROXY_CACHE_DIR_NAME } from '../../common/constants';
import type { AbbreviatedPackageManifestType, AbbreviatedPackageJSONType, PackageManifestType, PackageJSONType } from '../../repository/PackageRepository';

function isoNow() {
  return new Date().toISOString();
}

export function isPkgManifest(fileType: DIST_NAMES) {
  return fileType === DIST_NAMES.FULL_MANIFESTS || fileType === DIST_NAMES.ABBREVIATED_MANIFESTS;
}

type GetSourceManifestAndCacheReturnType<T> = {
  proxyBytes: Buffer,
  manifest: T extends DIST_NAMES.ABBREVIATED | DIST_NAMES.MANIFEST ? AbbreviatedPackageJSONType | PackageJSONType :
    T extends DIST_NAMES.FULL_MANIFESTS | DIST_NAMES.ABBREVIATED_MANIFESTS ? AbbreviatedPackageManifestType|PackageManifestType : never;
};

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyCacheService extends AbstractService {
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;
  @Inject()
  private readonly proxyCacheRepository: ProxyCacheRepository;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly cacheService: CacheService;
  @Inject()
  private readonly backgroundTaskHelper:BackgroundTaskHelper;

  async getPackageManifest(fullname: string, fileType: DIST_NAMES.FULL_MANIFESTS| DIST_NAMES.ABBREVIATED_MANIFESTS): Promise<AbbreviatedPackageManifestType|PackageManifestType> {
    const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType))?.filePath;
    if (cachedStoreKey) {
      const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
      if (nfsBytes) {
        let nfsPkgManifgest;
        try {
          const nfsString = Buffer.from(nfsBytes).toString();
          nfsPkgManifgest = JSON.parse(nfsString);
        } catch {
          // JSON parse error
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
          throw new InternalServerError('manifest JSON in NFS parse error');
        }
        return nfsPkgManifgest;
      }
      await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
      throw new NotFoundError('can not found manifest in NFS.');
    }

    const { manifest } = await this.getSourceManifestAndCache<typeof fileType>(fullname, fileType);
    this.backgroundTaskHelper.run(async () => {
      const cachedFiles = ProxyCache.create({ fullname, fileType });
      await this.proxyCacheRepository.saveProxyCache(cachedFiles);
    });
    return manifest;
  }

  // used by GET /:fullname/:versionOrTag
  async getPackageVersionManifest(fullname: string, fileType: DIST_NAMES.ABBREVIATED | DIST_NAMES.MANIFEST, versionOrTag: string): Promise<AbbreviatedPackageJSONType|PackageJSONType> {
    let version;
    if (semverValid(versionOrTag)) {
      version = versionOrTag;
    } else {
      const pkgManifest = await this.getPackageManifest(fullname, DIST_NAMES.ABBREVIATED_MANIFESTS);
      const distTags = pkgManifest['dist-tags'] || {};
      version = distTags[versionOrTag] ? distTags[versionOrTag] : versionOrTag;
    }
    const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType, version))?.filePath;
    if (cachedStoreKey) {
      const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
      if (nfsBytes) {
        try {
          const nfsString = Buffer.from(nfsBytes).toString();
          return JSON.parse(nfsString) as PackageJSONType | AbbreviatedPackageJSONType;
        } catch {
          // JSON parse error
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
          throw new InternalServerError('manifest in NFS JSON parse error');
        }
      }
    }
    const { manifest } = await this.getSourceManifestAndCache(fullname, fileType, versionOrTag);
    this.backgroundTaskHelper.run(async () => {
      const cachedFiles = ProxyCache.create({ fullname, fileType, version });
      await this.proxyCacheRepository.saveProxyCache(cachedFiles);
    });
    return manifest;
  }

  async getSourceManifestAndCache<T extends DIST_NAMES>(fullname:string, fileType: T, versionOrTag?:string): Promise<GetSourceManifestAndCacheReturnType<T>> {
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
    if (isPkgManifest(fileType)) {
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
    let storeKey: string;
    if (isPkgManifest(fileType)) {
      storeKey = `/${PROXY_CACHE_DIR_NAME}/${fullname}/${fileType}`;
    } else {
      const version = manifest.version;
      storeKey = `/${PROXY_CACHE_DIR_NAME}/${fullname}/${version}/${fileType}`;
    }
    await this.nfsAdapter.uploadBytes(storeKey, proxyBytes);
    return { proxyBytes, manifest };
  }

  async removeProxyCache(fullname: string, fileType: DIST_NAMES, version?: string) {
    const storeKey = isPkgManifest(fileType)
      ? `/${PROXY_CACHE_DIR_NAME}/${fullname}/${fileType}`
      : `/${PROXY_CACHE_DIR_NAME}/${fullname}/${version}/${fileType}`;
    await this.nfsAdapter.remove(storeKey);
    await this.proxyCacheRepository.removeProxyCache(fullname, fileType, version);
  }

  async createTask(targetName: string, options: UpdateProxyCacheTaskOptions): Promise<CreateUpdateProxyCacheTask> {
    return await this.taskService.createTask(Task.createUpdateProxyCache(targetName, options), false) as CreateUpdateProxyCacheTask;
  }

  async findExecuteTask() {
    return await this.taskService.findExecuteTask(TaskType.UpdateProxyCache);
  }

  async executeTask(task: Task) {
    const logs: string[] = [];
    const fullname = (task as CreateUpdateProxyCacheTask).data.fullname;
    const { fileType, version } = (task as CreateUpdateProxyCacheTask).data;
    let cacheBytes;
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start update "${fullname}-${fileType}" 🚧🚧🚧🚧🚧`);
    try {
      if (isPkgManifest(fileType)) {
        const cachedFiles = await this.proxyCacheRepository.findProxyCache(fullname, fileType);
        if (!cachedFiles) throw new Error('task params error, can not found record in repo.');
        cacheBytes = (await this.getSourceManifestAndCache<typeof fileType>(fullname, fileType)).proxyBytes;
        ProxyCache.update(cachedFiles);
        await this.proxyCacheRepository.saveProxyCache(cachedFiles);
      } else {
        task.error = 'Unacceptable file type.';
        logs.push(`[${isoNow()}] ❌ ${task.error}`);
        logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname}-${fileType} ${version ?? ''} ❌❌❌❌❌`);
        await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
        this.logger.info('[ProxyCacheService.executeTask:fail] taskId: %s, targetName: %s, %s',
          task.taskId, task.targetName, task.error);
        return;
      }
    } catch (error) {
      task.error = error;
      logs.push(`[${isoNow()}] ❌ ${task.error}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ ${fullname}-${fileType} ${version ?? ''} ❌❌❌❌❌`);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      this.logger.info('[ProxyCacheService.executeTask:fail] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      return;
    }
    logs.push(`[${isoNow()}] 🟢 Update Success.`);
    const isFullManifests = fileType === DIST_NAMES.FULL_MANIFESTS;
    const cachedKey = await this.cacheService.getPackageEtag(fullname, isFullManifests);
    if (cachedKey) {
      const { shasum: etag } = await calculateIntegrity(cacheBytes);
      await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, cacheBytes);
      logs.push(`[${isoNow()}] 🟢 Update Cache Success.`);
    }
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
  }

}
