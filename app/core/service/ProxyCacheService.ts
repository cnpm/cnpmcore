import { EggHttpClient, HttpClientRequestOptions, HttpClientResponse, Context } from 'egg';
import { ForbiddenError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { BackgroundTaskHelper } from '@eggjs/tegg-background-task';
import { valid as semverValid } from 'semver';
import { AbstractService } from '../../common/AbstractService.js';
import { TaskService } from './TaskService.js';
import { CacheService } from './CacheService.js';
import { RegistryManagerService } from './RegistryManagerService.js';
import { NPMRegistry } from '../../common/adapter/NPMRegistry.js';
import { NFSAdapter } from '../../common/adapter/NFSAdapter.js';
import { ProxyCache } from '../entity/ProxyCache.js';
import { Task, UpdateProxyCacheTaskOptions, CreateUpdateProxyCacheTask } from '../entity/Task.js';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository.js';
import { TaskType, TaskState } from '../../common/enum/Task.js';
import { calculateIntegrity } from '../../common/PackageUtil.js';
import { ABBREVIATED_META_TYPE, PROXY_CACHE_DIR_NAME } from '../../common/constants.js';
import { DIST_NAMES, isPkgManifest } from '../entity/Package.js';
import type {
  AbbreviatedPackageManifestType,
  AbbreviatedPackageJSONType,
  PackageManifestType,
  PackageJSONType,
} from '../../repository/PackageRepository.js';

function isoNow() {
  return new Date().toISOString();
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

  async getPackageVersionTarResponse(fullname: string, ctx: Context): Promise<HttpClientResponse> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      throw new ForbiddenError(`stop proxy by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`);
    }
    return await this.getProxyResponse(ctx);
  }

  async getPackageManifest(fullname: string, fileType: DIST_NAMES.FULL_MANIFESTS| DIST_NAMES.ABBREVIATED_MANIFESTS): Promise<AbbreviatedPackageManifestType|PackageManifestType> {
    const isFullManifests = fileType === DIST_NAMES.FULL_MANIFESTS;
    const cachedStoreKey = (await this.proxyCacheRepository.findProxyCache(fullname, fileType))?.filePath;
    if (cachedStoreKey) {
      try {
        const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
        if (!nfsBytes) throw new Error('not found proxy cache, try again later.');

        const nfsBuffer = Buffer.from(nfsBytes);
        const { shasum: etag } = await calculateIntegrity(nfsBytes);
        await this.cacheService.savePackageEtagAndManifests(fullname, isFullManifests, etag, nfsBuffer);

        const nfsString = nfsBuffer.toString();
        const nfsPkgManifest = JSON.parse(nfsString);
        return nfsPkgManifest as AbbreviatedPackageManifestType|PackageManifestType;
      } catch (error) {
        /* c8 ignore next 6 */
        if (error.message.includes('not found proxy cache') || error.message.includes('Unexpected token : in JSON at')) {
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
        }
        throw error;
      }
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
      try {
        const nfsBytes = await this.nfsAdapter.getBytes(cachedStoreKey);
        if (!nfsBytes) throw new Error('not found proxy cache, try again later.');
        const nfsString = Buffer.from(nfsBytes!).toString();
        return JSON.parse(nfsString) as PackageJSONType | AbbreviatedPackageJSONType;
      } catch (error) {
        /* c8 ignore next 6 */
        if (error.message.includes('not found proxy cache') || error.message.includes('Unexpected token : in JSON at')) {
          await this.nfsAdapter.remove(cachedStoreKey);
          await this.proxyCacheRepository.removeProxyCache(fullname, fileType);
        }
        throw error;
      }
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

  replaceTarballUrl<T extends DIST_NAMES>(manifest: GetSourceManifestAndCacheReturnType<T>, fileType: T) {
    const { sourceRegistry, registry } = this.config.cnpmcore;
    if (isPkgManifest(fileType)) {
      // pkg manifest
      const versionMap = (manifest as AbbreviatedPackageManifestType|PackageManifestType)?.versions;
      for (const key in versionMap) {
        const versionItem = versionMap[key];
        if (versionItem?.dist?.tarball) {
          versionItem.dist.tarball = versionItem.dist.tarball.replace(sourceRegistry, registry);
        }
      }
    } else {
      // pkg version manifest
      const distItem = (manifest as AbbreviatedPackageJSONType | PackageJSONType).dist;
      if (distItem?.tarball) {
        distItem.tarball = distItem.tarball.replace(sourceRegistry, registry);
      }
    }
    return manifest;
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

  // only used by schedule task
  private async getRewrittenManifest<T extends DIST_NAMES>(fullname:string, fileType: T, versionOrTag?:string): Promise<GetSourceManifestAndCacheReturnType<T>> {
    let responseResult;
    const USER_AGENT = 'npm_service.cnpmjs.org/cnpmcore';
    switch (fileType) {
      case DIST_NAMES.FULL_MANIFESTS: {
        const url = `/${encodeURIComponent(fullname)}?t=${Date.now()}&cache=0`;
        responseResult = await this.getProxyResponse({ url, headers: { accept: 'application/json', 'user-agent': USER_AGENT } }, { dataType: 'json' });
        break;
      }
      case DIST_NAMES.ABBREVIATED_MANIFESTS: {
        const url = `/${encodeURIComponent(fullname)}?t=${Date.now()}&cache=0`;
        responseResult = await this.getProxyResponse({ url, headers: { accept: ABBREVIATED_META_TYPE, 'user-agent': USER_AGENT } }, { dataType: 'json' });
        break;
      }
      case DIST_NAMES.MANIFEST: {
        const url = `/${encodeURIComponent(fullname)}/${encodeURIComponent(versionOrTag!)}`;
        responseResult = await this.getProxyResponse({ url, headers: { accept: 'application/json', 'user-agent': USER_AGENT } }, { dataType: 'json' });
        break;
      }
      case DIST_NAMES.ABBREVIATED: {
        const url = `/${encodeURIComponent(fullname)}/${encodeURIComponent(versionOrTag!)}`;
        responseResult = await this.getProxyResponse({ url, headers: { accept: ABBREVIATED_META_TYPE, 'user-agent': USER_AGENT } }, { dataType: 'json' });
        break;
      }
      default:
        break;
    }

    // replace tarball url
    const manifest = this.replaceTarballUrl(responseResult!.data, fileType);
    return manifest;
  }

  private async storeRewrittenManifest(manifest: any, fullname: string, fileType: DIST_NAMES) {
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

  async getProxyResponse(ctx: Partial<Context>, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
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
        accept: ctx.headers?.accept,
        'user-agent': ctx.headers?.['user-agent'],
        authorization,
        'x-forwarded-for': ctx?.ip,
        via: `1.1, ${this.config.cnpmcore.registry}`,
      },
    }) as HttpClientResponse;
    this.logger.info('[ProxyCacheService:getProxyStreamResponse] %s, status: %s', url, res.status);
    return res;
  }
}
