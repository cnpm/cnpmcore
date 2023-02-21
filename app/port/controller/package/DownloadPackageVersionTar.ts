import {
  NotFoundError,
} from 'egg-errors';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { AbstractController } from '../AbstractController';
import { FULLNAME_REG_STRING, getScopeAndName } from '../../../common/PackageUtil';
import { NFSAdapter } from '../../../common/adapter/NFSAdapter';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { ProxyModeService } from '../../../core/service/ProxyModeService';
import { PackageSyncerService } from '../../../core/service/PackageSyncerService';
import { PackageVersion as PackageVersionEntity } from '../../../core/entity/PackageVersion';
import { Package as PackageEntity } from '../../../core/entity/Package';
@HTTPController()
export class DownloadPackageVersionTarController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private proxyModeService: ProxyModeService;
  @Inject()
  private packageSyncerService: PackageSyncerService;
  @Inject()
  private nfsAdapter: NFSAdapter;

  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.GET,
  })
  async download(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    // try nfs url first, avoid db query
    // tgz file storeKey: `/packages/${this.fullname}/${version}/${filename}`
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const storeKey = `/packages/${fullname}/${version}/${filenameWithVersion}.tgz`;
    const downloadUrl = await this.nfsAdapter.getDownloadUrl(storeKey);
    if (downloadUrl) {
      this.packageManagerService.plusPackageVersionCounter(fullname, version);
      ctx.redirect(downloadUrl);
      return;
    }

    // read from database
    let pkg: PackageEntity;
    try {
      pkg = await this.getPackageEntityByFullname(fullname);
    } catch (err) {
      if (err.name === 'PackageNotFoundError') {
        // proxy mode, package not found.
        if (this.enableProxyMode) {
          const tgzBuffer = await this.getPackageVersionTarAndCreateSpecVersionSyncTask(ctx, fullname, version);
          ctx.attachment(`${filenameWithVersion}.tgz`);
          return tgzBuffer;
        }
      }
      throw this.createPackageNotFoundError(fullname);
    }
    let packageVersion: PackageVersionEntity;
    try {
      packageVersion = await this.getPackageVersionEntity(pkg, version);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        if (this.enableProxyMode) {
          // proxy mode package version not found.
          const tgzBuffer = await this.getPackageVersionTarAndCreateSpecVersionSyncTask(ctx, fullname, version);
          ctx.attachment(`${filenameWithVersion}.tgz`);
          return tgzBuffer;
        }
      }
      throw new NotFoundError(`${pkg.fullname}@${version} not found`);
    }
    ctx.logger.info('[PackageController:downloadVersionTar] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    const urlOrStream = await this.packageManagerService.downloadPackageVersionTar(packageVersion);
    if (!urlOrStream) {
      throw new NotFoundError(`"${filenameWithVersion}.tgz" not found`);
    }
    this.packageManagerService.plusPackageVersionCounter(fullname, version);
    if (typeof urlOrStream === 'string') {
      ctx.redirect(urlOrStream);
      return;
    }
    ctx.attachment(`${filenameWithVersion}.tgz`);
    return urlOrStream;
  }

  @HTTPMethod({
    // GET /:fullname/download/:fullnameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/download/:fullnameWithVersion+.tgz`,
    method: HTTPMethodEnum.GET,
  })
  async deprecatedDownload(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() fullnameWithVersion: string) {
    // /@emotion/utils/download/@emotion/utils-0.11.3.tgz
    // => /@emotion/utils/-/utils-0.11.3.tgz
    const filenameWithVersion = getScopeAndName(fullnameWithVersion)[1];
    return await this.download(ctx, fullname, filenameWithVersion);
  }

  private async getPackageVersionTarAndCreateSpecVersionSyncTask(ctx: EggContext, fullname: string, version: string) {
    const { tgzBuffer, tempFilePath } = await this.proxyModeService.getPackageVersionTarAndTempFilePath(fullname, ctx.url);
    const task = await this.packageSyncerService.createTask(fullname, {
      authorIp: ctx.ip,
      authorId: `pid_${process.pid}`,
      tips: `Sync specific version in proxy mode cause by "${ctx.href}"`,
      skipDependencies: true,
      specificVersion: version,
      tempFilePath,
    });
    ctx.logger.info('[DownloadPackageVersionTarController.createSyncTask:success] taskId: %s, fullname: %s',
      task.taskId, fullname);
    return tgzBuffer;
  }

}
