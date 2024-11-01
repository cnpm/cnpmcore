import { PassThrough } from 'node:stream';
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
import { SyncMode } from '../../../common/constants';
import { NFSAdapter } from '../../../common/adapter/NFSAdapter';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { ProxyCacheService } from '../../../core/service/ProxyCacheService';
import { PackageSyncerService } from '../../../core/service/PackageSyncerService';
import { RegistryManagerService } from '../../../core/service/RegistryManagerService';

@HTTPController()
export class DownloadPackageVersionTarController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  registryManagerService: RegistryManagerService;
  @Inject()
  private proxyCacheService: ProxyCacheService;
  @Inject()
  private packageSyncerService: PackageSyncerService;
  @Inject()
  private nfsAdapter: NFSAdapter;

  // Support OPTIONS Request on tgz download
  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.OPTIONS,
  })
  async downloadForOptions(@Context() ctx: EggContext) {
    ctx.set('access-control-allow-origin', '*');
    ctx.set('access-control-allow-methods', 'GET,HEAD');
    ctx.status = 204;
  }

  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.GET,
  })
  async download(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    // tgz file storeKey: `/packages/${this.fullname}/${version}/${filename}`
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const storeKey = `/packages/${fullname}/${version}/${filenameWithVersion}.tgz`;
    const downloadUrl = await this.nfsAdapter.getDownloadUrl(storeKey);
    if (this.config.cnpmcore.syncMode === SyncMode.all && downloadUrl) {
      // try nfs url first, avoid db query
      this.packageManagerService.plusPackageVersionCounter(fullname, version);
      ctx.redirect(downloadUrl);
      return;
    }

    // check package version in database
    const allowSync = this.getAllowSync(ctx);
    let pkg;
    let packageVersion;
    try {
      pkg = await this.getPackageEntityByFullname(fullname, allowSync);
      packageVersion = await this.getPackageVersionEntity(pkg, version, allowSync);
    } catch (error) {
      if (this.config.cnpmcore.syncMode === SyncMode.proxy) {
        // proxy mode package version not found.
        const tgzStream = await this.getTgzProxyStream(ctx, fullname, version);
        this.packageManagerService.plusPackageVersionCounter(fullname, version);
        const passThroughRemoteStream = new PassThrough();
        tgzStream.pipe(passThroughRemoteStream);
        ctx.attachment(`${filenameWithVersion}.tgz`);
        return passThroughRemoteStream;
      }
      throw error;
    }

    // read by nfs url
    if (downloadUrl) {
      this.packageManagerService.plusPackageVersionCounter(fullname, version);
      ctx.redirect(downloadUrl);
      return;
    }
    // read from database
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

  private async getTgzProxyStream(ctx: EggContext, fullname: string, version: string) {
    const { headers, status, res } = await this.proxyCacheService.getPackageVersionTarResponse(fullname, ctx);
    ctx.status = status;
    ctx.set(headers as { [key: string]: string | string[] });
    ctx.runInBackground(async () => {
      const task = await this.packageSyncerService.createTask(fullname, {
        authorIp: ctx.ip,
        authorId: `pid_${process.pid}`,
        tips: `Sync specific version in proxy mode cause by "${ctx.href}"`,
        skipDependencies: true,
        specificVersions: [ version ],
      });
      ctx.logger.info('[DownloadPackageVersionTarController.createSyncTask:success] taskId: %s, fullname: %s',
        task.taskId, fullname);
    });
    return res;
  }

  // Compatible Verdaccio path style

  @HTTPMethod({
    // GET /:fullname/-/:scope/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:scope/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.OPTIONS,
  })
  async downloadVerdaccioPathStyleorOptions(@Context() ctx: EggContext) {
    return this.downloadForOptions(ctx);
  }

  @HTTPMethod({
    // GET /:fullname/-/:scope/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:scope/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.GET,
  })
  async downloadVerdaccioPathStyle(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    return this.download(ctx, fullname, filenameWithVersion);
  }
}
