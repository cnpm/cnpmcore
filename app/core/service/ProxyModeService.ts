import { InternalServerError, ForbiddenError, HttpError } from 'egg-errors';
import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { EggHttpClient } from 'egg';
import { calculateIntegrity } from '../../common/PackageUtil';
import { downloadToTempfile } from '../../common/FileUtil';
import { NPMRegistry, RegistryResponse } from '../../common/adapter/NPMRegistry';
import { AbstractService } from '../../common/AbstractService';
import { readFile, rm } from 'node:fs/promises';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { PROXY_MODE_CACHED_PACKAGE_DIR_NAME } from '../../common/constants';
import { DIST_NAMES } from '../entity/Package';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ProxyModeService extends AbstractService {
  @Inject()
  private readonly httpclient: EggHttpClient;
  @Inject()
  private readonly npmRegistry: NPMRegistry;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

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

  // used by GET /:fullname
  async getPackageFullManifests(fullname: string) {
    return await this._getPackageFullOrAbbreviatedManifest(fullname, true);
  }

  // used by GET /:fullname | GET /:fullname/:versionOrTag | GET /-/package/:fullname/dist-tags
  async getPackageAbbreviatedManifests(fullname: string) {
    return await this._getPackageFullOrAbbreviatedManifest(fullname, false);
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
      return nfsPkgVersionManifgest;
    }

    // not in NFS
    const responseResult = await this.npmRegistry.getPackageVersionManifest(fullname, version);
    if (responseResult.status !== 200) {
      throw new HttpError({
        status: responseResult.status,
        message: responseResult.data || responseResult.statusText,
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
        const decoder = new TextDecoder();
        const nfsString = decoder.decode(nfsBytes);
        nfsPkgManifgest = JSON.parse(nfsString);
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
    if (isFullManifests) {
      responseResult = await this.npmRegistry.getFullManifests(fullname);
    } else {
      responseResult = await this.npmRegistry.getAbbreviatedManifests(fullname);
    }
    if (responseResult.status !== 200) {
      throw new HttpError({
        status: responseResult.status,
        message: responseResult.data?.error || responseResult.statusText,
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

}
