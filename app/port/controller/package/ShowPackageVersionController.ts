import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';
import semver from 'semver';
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';

@HTTPController()
export class ShowPackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname/:versionOrTag
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionOrTag`,
    method: HTTPMethodEnum.GET,
  })
  async show(@HTTPParam() fullname: string, @HTTPParam() versionOrTag: string) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.getPackageEntity(scope, name);
    let version = versionOrTag;
    if (!semver.valid(versionOrTag)) {
      // invalid version, versionOrTag is a tag
      const packageTag = await this.packageRepository.findPackageTag(pkg.packageId, versionOrTag);
      if (packageTag) {
        version = packageTag.version;
      }
    }
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    const packageVersionJson = await this.packageManagerService.findPackageVersionManifest(packageVersion.packageId, version);
    return packageVersionJson;
  }
}
