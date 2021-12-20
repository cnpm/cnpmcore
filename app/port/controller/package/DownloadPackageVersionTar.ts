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
import { PackageManagerService } from '../../../core/service/PackageManagerService';

@HTTPController()
export class DonwloadPackageVersionTarController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: `/:fullname(${FULLNAME_REG_STRING})/-/:filenameWithVersion.tgz`,
    method: HTTPMethodEnum.GET,
  })
  async download(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const pkg = await this.getPackageEntityByFullname(fullname);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    ctx.logger.info('[PackageController:downloadVersionTar] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    const urlOrStream = await this.packageManagerService.downloadPackageVersionTar(packageVersion);
    if (!urlOrStream) {
      throw new NotFoundError(`"${filenameWithVersion}" not found`);
    }
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
    const filenameWithVersion = getScopeAndName(fullnameWithVersion)[1];
    return await this.download(ctx, fullname, filenameWithVersion);
  }
}
