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

@HTTPController()
export class DownloadPackageVersionTarController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
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
    const pkg = await this.getPackageEntityByFullname(fullname);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
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
}
