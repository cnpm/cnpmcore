import { InternalServerError, ForbiddenError, HttpError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import {
  EggContextHttpClient,
} from 'egg';
import { calculateIntegrity } from '../../common/PackageUtil';
import { getScopeAndName } from '../../common/PackageUtil';
import { downloadToTempfile } from '../../common/FileUtil';
import { NPMRegistry, RegistryResponse } from '../../common/adapter/NPMRegistry';
import { UserRepository } from '../../repository/UserRepository';
import { AbstractService } from '../../common/AbstractService';
import { RegistryManagerService } from './RegistryManagerService';
import { PackageManagerService } from './PackageManagerService';
import { PackageRepository } from '../../repository/PackageRepository';
import { UserService } from './UserService';
import { CacheService } from './CacheService';
import { User } from '../entity/User';
import { rm, readFile } from 'fs/promises';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { Registry } from '../entity/Registry';
import { RegistryType } from '../../common/enum/Registry';
import { PROXY_MODE_CACHED_PACKAGE_DIR_NAME } from '../../common/constants';
import { DIST_NAMES } from '../entity/Package';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyModeService extends AbstractService {
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly userRepository: UserRepository;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly userService: UserService;
  @Inject()
  private readonly cacheService: CacheService;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  async getPackageVersionTarAndPublish(fullname: string, version: string, url: string): Promise<Buffer| null> {
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      throw new ForbiddenError(`stop proxy by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`);
    }
    const requestTgzURL = `${this.npmRegistry.registry}/${url}`;
    let tmpfile:string;
    try {
      ({ tmpfile } = await downloadToTempfile(this.httpclient, this.config.dataDir, requestTgzURL));
    } catch (error) {
      throw new InternalServerError('get uplink tgz file failed.');
    }

    const tgzBuffer = await readFile(tmpfile);
    // FIXME: should it run in background?
    await this.publishDownloadPackageVersionTar(fullname, version, tmpfile);
    return tgzBuffer;
  }

  // used by GET /:fullname
  async getPackageFullManifests(fullname: string) {
    return this._getPackageFullOrAbbreviatedManifest(fullname, true);
  }

  // used by GET /:fullname | GET /:fullname/:versionOrTag | GET /-/package/:fullname/dist-tags
  async getPackageAbbreviatedManifests(fullname: string) {
    return this._getPackageFullOrAbbreviatedManifest(fullname, false);
  }

  // used by GET /:fullname/:versionOrTag
  async getPackageVersionOrTagManifest(fullname: string, versionOrTag: string) {
    const { data: manifest } = await this.getPackageAbbreviatedManifests(fullname);
    const distTags = manifest['dist-tags'] || {};
    const version = distTags[versionOrTag] ? distTags[versionOrTag] : versionOrTag;
    const storeKey = `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/${fullname}/${version}/${DIST_NAMES.MANIFEST}`;
    const nfsBytes = await this.nfsAdapter.getBytes(storeKey);
    if (nfsBytes) {
      let nfsPkgVersionManifgest = {};
      try {
        nfsPkgVersionManifgest = JSON.parse(Buffer.from(nfsBytes).toString('utf8'));
      } catch {
        // JSON parse error
        await this.nfsAdapter.remove(storeKey);
        throw new InternalServerError('manifest in NFS JSON parse error');
      }
      const { shasum: etag } = await calculateIntegrity(nfsBytes);
      return { data: nfsPkgVersionManifgest, etag, blockReason: '' };
    }

    // not in NFS
    let responseResult: RegistryResponse;
    try {
      responseResult = await this.npmRegistry.getPackageVersionManifest(fullname, version);
    } catch (error) {
      throw new InternalServerError('connect to uplink server failed.');
    }
    if (responseResult.status !== 200) {
      throw new HttpError({
        status: responseResult.status,
        message: responseResult.data,
      });
    }

    // get version manifest success
    const pkgVerisonManifest = responseResult.data;
    const { sourceRegistry, registry } = this.config.cnpmcore;
    const pkgVerisonManifestDist = pkgVerisonManifest.dist;
    if (pkgVerisonManifestDist && pkgVerisonManifestDist.tarball) {
      pkgVerisonManifestDist.tarball = pkgVerisonManifestDist.tarball.replace(sourceRegistry, registry);
    }
    const proxyBytes = Buffer.from(JSON.stringify(pkgVerisonManifest));
    await this.nfsAdapter.uploadBytes(storeKey, proxyBytes);
    return pkgVerisonManifest;
  }

  private async _getPackageFullOrAbbreviatedManifest(fullname: string, isFullManifests: boolean) {
    // check package is blocked
    if (this.config.cnpmcore.syncPackageBlockList.includes(fullname)) {
      const error = `stop cache by block list: ${JSON.stringify(this.config.cnpmcore.syncPackageBlockList)}`;
      this.logger.info('[ProxyPackageAndPublishService.cacheManifests:fail-block-list] targetName: %s, %s',
        fullname, error);
      throw new ForbiddenError('this package is in block list');
    }

    const storeKey = isFullManifests ?
      `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/${fullname}/${DIST_NAMES.FULL_MANIFESTS}` : `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/${fullname}/${DIST_NAMES.ABBREVIATED_MANIFESTS}`;
    const nfsBytes = await this.nfsAdapter.getBytes(storeKey);
    if (nfsBytes) {
      let nfsPkgManifgest = {};
      try {
        nfsPkgManifgest = JSON.parse(Buffer.from(nfsBytes).toString('utf8'));
      } catch {
        // JSON parse error
        await this.nfsAdapter.remove(storeKey);
        throw new InternalServerError('manifest in NFS JSON parse error');
      }
      const { shasum: etag } = await calculateIntegrity(nfsBytes);
      return { data: nfsPkgManifgest, etag, blockReason: '' };
    }

    // not in NFS
    let responseResult: RegistryResponse;
    try {
      if (isFullManifests) {
        responseResult = await this.npmRegistry.getFullManifests(fullname);
      } else {
        responseResult = await this.npmRegistry.getAbbreviatedManifests(fullname);
      }
    } catch (err: any) {
      throw new InternalServerError('connect to uplink server failed.');
    }
    if (responseResult.status !== 200) {
      throw new HttpError({
        status: responseResult.status,
        message: responseResult.data?.error,
      });
    }

    // get manifest success
    const pkgManifest = responseResult.data;
    const { sourceRegistry, registry } = this.config.cnpmcore;
    const versionMap = pkgManifest.versions || {};
    for (const key in versionMap) {
      const versionItem = versionMap[key];
      if (versionItem.dist && versionItem.dist.tarball && typeof versionItem.dist.tarball === 'string') {
        versionItem.dist.tarball = versionItem.dist.tarball.replace(sourceRegistry, registry);
      }
    }
    const proxyBytes = Buffer.from(JSON.stringify(pkgManifest));
    await this.nfsAdapter.uploadBytes(storeKey, proxyBytes);
    const { shasum: etag } = await calculateIntegrity(proxyBytes);
    return { data: pkgManifest, etag, blockReason: '' };
  }

  private async publishDownloadPackageVersionTar(fullname, version, tmpfile) {
    const [ scope, name ] = getScopeAndName(fullname);
    const { data } = await this.getPackageFullManifests(fullname);
    const registry = await this.initProxyModeRegistry();
    const versionMap = data.versions || {};
    if (!versionMap[version]) {
      return null;
    }
    const item = versionMap[version];
    const description: string = item.description;
    const timeMap = data.time || {};
    const distTags = data['dist-tags'] || {};

    // format readme
    let readme = data.readme || '';
    if (typeof readme !== 'string') {
      readme = JSON.stringify(readme);
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
        }
      }
    }

    if (Array.isArray(maintainers) && maintainers.length > 0) {
      for (const maintainer of maintainers) {
        if (maintainer.name && maintainer.email) {
          maintainersMap[maintainer.name] = maintainer;
          const { user, changed } = await this.userService.saveUser(registry?.userPrefix, maintainer.name, maintainer.email);
          users.push(user);
          if (changed) {
            changedUserCount++;
            this.logger.info(`[ProxyPackageAndPublishService.publishDownloadPackageVersionTar:sync maintainer success] 🟢 [${changedUserCount}] Synced ${maintainer.name} => ${user.name}(${user.userId})`);
          }
        }
      }
    }

    if (users.length === 0) {
      this.logger.info('[ProxyPackageAndPublishService.publishDownloadPackageVersionTar:fail-invalid-maintainers] packageName: %s, version: %s', fullname, version);
      throw new InternalServerError(`invalid maintainers: ${JSON.stringify(maintainers)}`);
    }

    // 2. save version
    const publishTimeISO = timeMap[version];
    const publishTime = publishTimeISO ? new Date(publishTimeISO) : new Date();
    const publishCmd = {
      scope,
      name,
      version,
      description,
      packageJson: item,
      readme,
      registryId: registry?.registryId,
      dist: {
        localFile: tmpfile,
      },
      isPrivate: false,
      publishTime,
      skipRefreshPackageManifests: true,
    };
    const pkgVersion = await this.packageManagerService.publish(publishCmd, users[0]);
    this.logger.info('[ProxyPackageAndPublishService.publishDownloadPackageVersionTar:publish success] targetName: %s, %s', fullname, pkgVersion.version);

    // existItem logic would not appear in proxy mode.
    // and also, remove versions logic would not appear.

    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      throw new InternalServerError('publish package failed');
    }
    // refresh manifests
    await this.packageManagerService.refreshPackageChangeVersionsToDists(pkg, [ version ]);

    // 3. update tags
    // "dist-tags": {
    //   "latest": "0.0.7"
    // },
    const { data: existsData } = await this.packageManagerService.listPackageFullManifests(scope, name);
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
      this.logger.info('[ProxyPackageAndPublishService.publishDownloadPackageVersionTar:sync tags success] pacakge: %s, %s tags: %s', fullname, changedTags.length, changedTags.map(item => item.tag));
    }
    if (shouldRefreshDistTags) {
      await this.packageManagerService.refreshPackageDistTagsToDists(pkg);
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
      this.logger.info('[ProxyPackageAndPublishService.publishDownloadPackageVersionTar]: Removed %s maintainers: %s', removedMaintainers.length, JSON.stringify(removedMaintainers));
    } else if (shouldRefreshMaintainers) {
      await this.packageManagerService.refreshPackageMaintainersToDists(pkg);
      this.logger.info('[ProxyPackageAndPublishService.publishDownloadPackageVersionTar]: Refresh maintainers');
    }

    // clean cache
    await rm(tmpfile, { force: true });
    await this.cacheService.removeCache(fullname);
  }

  async initProxyModeRegistry(): Promise<Registry | null> {
    // 代理模式仅使用默认仓库，暂不实现Verdaccio的多上游仓库的功能
    const targetHost: string = this.config.cnpmcore.sourceRegistry;
    let registry = await this.registryManagerService.findByRegistryName('default');
    // 更新 targetHost 地址
    // defaultRegistry 可能还未创建
    if (!registry) {
      // 从配置文件默认生成
      const { changesStreamRegistryMode, changesStreamRegistry: changesStreamHost, sourceRegistry: host } = this.config.cnpmcore;
      const type = changesStreamRegistryMode === 'json' ? RegistryType.Cnpmcore : RegistryType.Npm;
      registry = await this.registryManagerService.createRegistry({
        name: 'default',
        type,
        userPrefix: 'npm:',
        host,
        changeStream: `${changesStreamHost}/_changes`,
      });
    }
    this.npmRegistry.setRegistryHost(targetHost);
    return registry;
  }
}
