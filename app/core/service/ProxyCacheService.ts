import { EggHttpClient, HttpClientRequestOptions, HttpClientResponse } from 'egg';
import { ForbiddenError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject, EggContext } from '@eggjs/tegg';
import { BackgroundTaskHelper } from '@eggjs/tegg-background-task';
import { valid as semverValid } from 'semver';
import { AbstractService } from '../../common/AbstractService';
import { TaskService } from './TaskService';
import { CacheService } from './CacheService';
import { RegistryManagerService } from './RegistryManagerService';
import { NPMRegistry } from '../../common/adapter/NPMRegistry';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { ProxyCache } from '../entity/ProxyCache';
import { Task, UpdateProxyCacheTaskOptions, CreateUpdateProxyCacheTask } from '../entity/Task';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { TaskType, TaskState } from '../../common/enum/Task';
import { calculateIntegrity } from '../../common/PackageUtil';
import { ABBREVIATED_META_TYPE, PROXY_CACHE_DIR_NAME } from '../../common/constants';
import { DIST_NAMES } from '../entity/Package';
import type { AbbreviatedPackageManifestType, AbbreviatedPackageJSONType, PackageManifestType, PackageJSONType } from '../../repository/PackageRepository';
import { PackageManagerService } from './PackageManagerService';
import { getScopeAndName } from '../../common/PackageUtil';

function isoNow() {
  return new Date().toISOString();
}

export function isPkgManifest(fileType: DIST_NAMES) {
  return fileType === DIST_NAMES.FULL_MANIFESTS || fileType === DIST_NAMES.ABBREVIATED_MANIFESTS;
}

type GetSourceManifestAndCacheReturnType<T> = T extends DIST_NAMES.ABBREVIATED | DIST_NAMES.MANIFEST ? AbbreviatedPackageJSONType | PackageJSONType :
  T extends DIST_NAMES.FULL_MANIFESTS | DIST_NAMES.ABBREVIATED_MANIFESTS ? AbbreviatedPackageManifestType|PackageManifestType : never;


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
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly cacheService: CacheService;
  @Inject()
  private readonly backgroundTaskHelper:BackgroundTaskHelper;
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  async getPackageVersionTarResponse(fullname: string, ctx: EggContext): Promise<HttpClientResponse> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      throw new ForbiddenError(`stop proxy by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`);
    }
    return await this.getProxyResponse(ctx);
  }

  async getPackageManifest(fullname: string, fileType: DIST_NAMES.FULL_MANIFESTS| DIST_NAMES.ABBREVIATED_MANIFESTS): Promise<AbbreviatedPackageManifestType|PackageManifestType> {
    try {
      const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType))?.filePath;
      if (cachedStoreKey) {
        const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
        const nfsString = Buffer.from(nfsBytes!).toString();
        const nfsPkgManifest = JSON.parse(nfsString);
        return nfsPkgManifest;
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.error('[ProxyCacheService.getPackageManifest:error] get cache error, ignore');
    }

    const manifest = await this.getRewrittenManifest<typeof fileType>(fullname, fileType);
    this.backgroundTaskHelper.run(async () => {
      await this.storeRewrittenManifest(manifest, fullname, fileType);
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
      const nfsString = Buffer.from(nfsBytes!).toString();
      return JSON.parse(nfsString) as PackageJSONType | AbbreviatedPackageJSONType;
    }
    const manifest = await this.getRewrittenManifest(fullname, fileType, versionOrTag);
    this.backgroundTaskHelper.run(async () => {
      await this.storeRewrittenManifest(manifest, fullname, fileType);
      const cachedFiles = ProxyCache.create({ fullname, fileType, version });
      await this.proxyCacheRepository.saveProxyCache(cachedFiles);
    });
    return manifest;
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
    let cachedManifest;
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start update "${fullname}-${fileType}" 🚧🚧🚧🚧🚧`);
    try {
      const cachedFiles = await this.proxyCacheRepository.findProxyCache(fullname, fileType);
      if (!cachedFiles) throw new Error('task params error, can not found record in repo.');
      cachedManifest = await this.getRewrittenManifest<typeof fileType>(fullname, fileType);
      await this.storeRewrittenManifest(cachedManifest, fullname, fileType);
      ProxyCache.update(cachedFiles);
      await this.proxyCacheRepository.saveProxyCache(cachedFiles);
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
      const cacheBytes = Buffer.from(JSON.stringify(cachedManifest));
      const { shasum: etag } = await calculateIntegrity(cacheBytes);
      await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, cacheBytes);
      logs.push(`[${isoNow()}] 🟢 Update Cache Success.`);
    }
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
  }

  async getRewrittenManifest<T extends DIST_NAMES>(fullname:string, fileType: T, versionOrTag?:string): Promise<GetSourceManifestAndCacheReturnType<T>> {
    const [ scope, name ] = getScopeAndName(fullname);
    let responseResult;
    switch (fileType) {
      case DIST_NAMES.FULL_MANIFESTS:
        responseResult = await this.getUpstreamFullManifests(fullname);
        break;
      case DIST_NAMES.ABBREVIATED_MANIFESTS:
        responseResult = await this.getUpstreamAbbreviatedManifests(fullname);
        break;
      case DIST_NAMES.MANIFEST:
        responseResult = await this.getUpstreamPackageVersionManifest(fullname, versionOrTag!);
        break;
      case DIST_NAMES.ABBREVIATED:
        responseResult = await this.getUpstreamAbbreviatedPackageVersionManifest(fullname, versionOrTag!);
        break;
      default:
        break;
    }

    // replace tarball url
    const { status, data: manifest } = responseResult;
    // sourceRegistry not found, check private package
    if (status === 404) {
      const { etag, data: manifest, blockReason } = fileType === DIST_NAMES.FULL_MANIFESTS ?
        await this.packageManagerService.listPackageFullManifests(scope, name, false) :
        await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, false);
      // found in private package
      if (etag && !blockReason) {
        return manifest as any;
      }
    }
    const { sourceRegistry, registry } = this.config.cnpmcore;
    if (isPkgManifest(fileType)) {
      const { etag, data, blockReason } = fileType === DIST_NAMES.FULL_MANIFESTS ?
        await this.packageManagerService.listPackageFullManifests(scope, name, false) :
        await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, false);
      const hasPrivatePackage = etag && !blockReason;

      // pkg manifest
      const versionMap = manifest.versions || {};
      for (const key in versionMap) {
        const versionItem = versionMap[key];
        if (versionItem?.dist?.tarball) {
          versionItem.dist.tarball = versionItem.dist.tarball.replace(sourceRegistry, registry);
        }
      }
      // private manifest
      if (hasPrivatePackage) {
        const privateVersionMap = data?.versions || {};
        for (const key in privateVersionMap) {
          if (!versionMap[key]) {
            versionMap[key] = privateVersionMap[key];
          }
        }
        if (manifest.time) {
          const privateTimeMap = data?.time || {};
          for (const key in privateTimeMap) {
            if (!manifest.time[key]) {
              manifest.time[key] = privateTimeMap[key];
            }
          }
        }
      }
    } else {
      // pkg version manifest
      const distItem = manifest?.dist || {};
      if (distItem.tarball) {
        distItem.tarball = distItem.tarball.replace(sourceRegistry, registry);
      }
    }
    return manifest;
  }

  private async storeRewrittenManifest(manifest, fullname: string, fileType: DIST_NAMES) {
    let storeKey: string;
    if (isPkgManifest(fileType)) {
      storeKey = `/${PROXY_CACHE_DIR_NAME}/${fullname}/${fileType}`;
    } else {
      const version = manifest.version;
      storeKey = `/${PROXY_CACHE_DIR_NAME}/${fullname}/${version}/${fileType}`;
    }
    const nfsBytes = Buffer.from(JSON.stringify(manifest));
    await this.nfsAdapter.uploadBytes(storeKey, nfsBytes);
  }

  private async getProxyResponse(ctx: Partial<EggContext>, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    const registry = this.npmRegistry.registry;
    const remoteAuthToken = await this.registryManagerService.getAuthTokenByRegistryHost(registry);
    const authorization = this.npmRegistry.genAuthorizationHeader(remoteAuthToken);

    const url = `${this.npmRegistry.registry}${ctx.url}`;

    const res = await this.httpclient.request(url, {
      timing: true,
      followRedirect: true,
      // once redirection is also count as a retry
      retry: 7,
      dataType: 'stream',
      timeout: 10000,
      compressed: true,
      ...options,
      headers: {
        accept: ctx.header?.accept,
        'user-agent': ctx.header?.['user-agent'],
        authorization,
        'x-forwarded-for': ctx?.ip,
        via: `1.1, ${this.config.cnpmcore.registry}`,
      },
    }) as HttpClientResponse;
    this.logger.info('[ProxyCacheService:getProxyStreamResponse] %s, status: %s', url, res.status);
    return res;
  }

  private async getUpstreamFullManifests(fullname: string): Promise<HttpClientResponse> {
    const url = `/${encodeURIComponent(fullname)}?t=${Date.now()}&cache=0`;
    return await this.getProxyResponse({ url }, { dataType: 'json' });
  }

  private async getUpstreamAbbreviatedManifests(fullname: string): Promise<HttpClientResponse> {
    const url = `/${encodeURIComponent(fullname)}?t=${Date.now()}&cache=0`;
    return await this.getProxyResponse({ url, headers: { accept: ABBREVIATED_META_TYPE } }, { dataType: 'json' });
  }
  private async getUpstreamPackageVersionManifest(fullname: string, versionOrTag: string): Promise<HttpClientResponse> {
    const url = `/${encodeURIComponent(fullname)}/${encodeURIComponent(versionOrTag)}`;
    return await this.getProxyResponse({ url }, { dataType: 'json' });
  }
  private async getUpstreamAbbreviatedPackageVersionManifest(fullname: string, versionOrTag: string): Promise<HttpClientResponse> {
    const url = `/${encodeURIComponent(fullname)}/${encodeURIComponent(versionOrTag)}`;
    return await this.getProxyResponse({ url, headers: { accept: ABBREVIATED_META_TYPE } }, { dataType: 'json' });
  }

}
