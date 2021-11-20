import { PackageJson, Simplify } from 'type-fest';
import { UnprocessableEntityError, NotFoundError } from 'egg-errors';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import {
  EggLogger,
} from 'egg';
import * as ssri from 'ssri';
import * as semver from 'semver';
import { BaseController } from '../type/BaseController';
import { PackageRepository } from 'app/repository/PackageRepository';
import { getFullname, getScopeAndName } from '../../common/PackageUtil';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { Package } from 'app/core/entity/Package';

type PackageVersion = Simplify<PackageJson.PackageJsonStandard & {
  name: 'string';
  version: 'string';
  deprecated?: 'string';
  readme?: 'string';
  dist?: {
    shasum: string;
    integrity: string;
    [key: string]: string | number;
  },
}>;

const FullPackageRule = {
  name: 'string',
  // should has at least one version
  versions: 'object',
  // deprecated request can only has versions
  _attachments: 'object?',
  description: 'string?',
  'dist-tags': 'object?',
  readme: 'string?',
};

type FullPackage = {
  name: string;
  versions: {
    [key: string]: PackageVersion;
  },
  // maintainers: JsonObject[],
  _attachments?: {
    [key: string]: {
      content_type: string;
      data: string;
      length: number;
    };
  },
  description?: string;
  'dist-tags'?: {
    [key: string]: string;
  };
  readme?: string;
};

// https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
const PACKAGE_NAME_PATH = '/:fullname(@[^/]+\/[^/]+|[^@/]+)';
const PACKAGE_NAME_WITH_VERSION_PATH = `${PACKAGE_NAME_PATH}/:version`;
const PACKAGE_TAR_DOWNLOAD_PATH = `${PACKAGE_NAME_PATH}/-/:filenameWithVersion.tgz`;
// base64 regex https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@HTTPController()
export class PackageController extends BaseController {
  @Inject()
  private logger: EggLogger;
  @Inject()
  private packageRepository: PackageRepository;
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname
    path: PACKAGE_NAME_PATH,
    method: HTTPMethodEnum.GET,
  })
  async showPackage(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    // FIXME: validate name
    // https://github.com/npm/validate-npm-package-name
    const requestEtag = ctx.request.headers['if-none-match'];
    const abbreviatedMetaType = 'application/vnd.npm.install-v1+json';
    const [ scope, name ] = getScopeAndName(fullname);
    let result: { etag: string; data: any };
    if (ctx.accepts([ 'json', abbreviatedMetaType ]) === abbreviatedMetaType) {
      result = await this.packageManagerService.listPackageAbbreviatedManifests(scope, name, requestEtag);
    } else {
      result = await this.packageManagerService.listPackageFullManifests(scope, name, requestEtag);
    }
    const { etag, data } = result;
    // 404, no data
    if (!etag) {
      throw new NotFoundError(`${fullname} not found`);
    }

    if (data) {
      // set etag
      // https://forum.nginx.org/read.php?2,240120,240120#msg-240120
      // should set weak etag avoid nginx remove it
      ctx.set('etag', `W/${etag}`);
    } else {
      // match etag, set status 304
      ctx.status = 304;
    }
    return data;
  }

  @HTTPMethod({
    // GET /:fullname/:version
    path: PACKAGE_NAME_WITH_VERSION_PATH,
    method: HTTPMethodEnum.GET,
  })
  async showVersion(@HTTPParam() fullname: string, @HTTPParam() version: string) {
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.getPackageEntity(scope, name);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    const [ packageVersionJson, readme ] = await Promise.all([
      this.packageManagerService.readDistBytesToJSON(packageVersion.manifestDist),
      this.packageManagerService.readDistBytesToString(packageVersion.readmeDist)
    ]);
    packageVersionJson.readme = readme;
    return packageVersionJson;
  }

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#publish-a-new-package
  @HTTPMethod({
    // PUT /:fullname
    path: PACKAGE_NAME_PATH,
    method: HTTPMethodEnum.PUT,
  })
  async saveVersion(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() pkg: FullPackage) {
    // TODO: using https://github.com/npm/validate-npm-package-name to validate package name
    ctx.validate(FullPackageRule, pkg);
    if (fullname !== pkg.name) {
      throw new UnprocessableEntityError(`fullname(${fullname}) not match package.name(${pkg.name})`);
    }
    const versions = Object.values(pkg.versions);
    if (versions.length === 0) {
      throw new UnprocessableEntityError('versions is empty');
    }

    // auth maintainter
    const attachments = pkg._attachments ?? {};
    const attachmentFilename = Object.keys(attachments)[0];

    if (!attachmentFilename) {
      const isDeprecatedRequest = versions.some(version => !!version.deprecated);
      // handle deprecated request
      if (isDeprecatedRequest) {
        return await this.saveDeprecatedVersions(pkg.name, versions);
      }

      // invalid attachments
      throw new UnprocessableEntityError('_attachments is empty');
    }

    // handle add new version
    const packageVersion = versions[0];
    // check version format
    this.checkPackageVersionFormat(packageVersion.version);

    const attachment = attachments[attachmentFilename];
    const distTags = pkg['dist-tags'] ?? {};
    const tag = Object.keys(distTags)[0];
    if (!tag) {
      throw new UnprocessableEntityError('dist-tags is empty');
    }

    // FIXME: make sure publisher in maintainers

    // check attachment data format and size
    if (!attachment.data || typeof attachment.data !== 'string' || !PACKAGE_ATTACH_DATA_RE.test(attachment.data)) {
      throw new UnprocessableEntityError('attachment.data format invalid');
    }
    const tarballBytes = Buffer.from(attachment.data, 'base64');
    if (tarballBytes.length !== attachment.length) {
      throw new UnprocessableEntityError(`attachment size ${attachment.length} not match download size ${tarballBytes.length}`);
    }

    // check integrity or shasum
    const integrity = packageVersion.dist?.integrity;
    // for content security reason
    // check integrity
    if (integrity) {
      const algorithm = ssri.checkData(tarballBytes, integrity);
      if (!algorithm) {
        throw new UnprocessableEntityError('dist.integrity invalid');
      }
    } else {
      const integrityObj = ssri.fromData(tarballBytes, {
        algorithms: [ 'sha1' ],
      });
      const shasum = integrityObj.sha1[0].hexDigest();
      if (packageVersion.dist?.shasum && packageVersion.dist.shasum !== shasum) {
        // if integrity not exists, check shasum
        throw new UnprocessableEntityError('dist.shasum invalid');
      }
    }

    // make sure readme is string
    const readme = typeof packageVersion.readme === 'string' ? packageVersion.readme : '';
    // remove readme
    packageVersion.readme = undefined;
    // make sure description is string
    if (typeof packageVersion.description !== 'string') {
      packageVersion.description = '';
    }
    const [ scope, name ] = getScopeAndName(fullname);
    const packageVersionEntity = await this.packageManagerService.publish({
      scope,
      name,
      version: packageVersion.version,
      description: packageVersion.description,
      packageJson: packageVersion,
      readme,
      dist: {
        content: tarballBytes,
      },
      tag,
      isPrivate: true,
    });
    this.logger.info('[package:version:add] %s@%s, packageVersionId: %s, tag: %s',
      packageVersion.name, packageVersion.version, packageVersionEntity.packageVersionId, tag);

    // make sure the latest version exists
    ctx.status = 201;
    return {
      ok: true,
      rev: `${packageVersionEntity.id}-${packageVersionEntity.packageVersionId}`,
    };
  }

  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: PACKAGE_TAR_DOWNLOAD_PATH,
    method: HTTPMethodEnum.GET,
  })
  async downloadVersionTar(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    // @foo/bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    // bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    const version = filenameWithVersion.substring(name.length + 1);
    // check version format
    this.checkPackageVersionFormat(version);
    const pkg = await this.getPackageEntity(scope, name);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    ctx.logger.info('[package:version:download-tar] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    const urlOrStream = await this.packageManagerService.downloadDist(packageVersion.tarDist);
    if (typeof urlOrStream === 'string') {
      ctx.redirect(urlOrStream);
      return;
    }
    ctx.attachment(`${filenameWithVersion}.tgz`);
    return urlOrStream;
  }

  // try to get package entity, throw NotFoundError when package not exists
  private async getPackageEntity(scope: string, name: string) {
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (!packageEntity) {
      const fullname = getFullname(scope, name);
      throw new NotFoundError(`${fullname} not found`);
    }
    return packageEntity;
  }

  private async getPackageVersionEntity(pkg: Package, version: string) {
    const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
    if (!packageVersion) {
      throw new NotFoundError(`${pkg.fullname}@${version} not found`);
    }
    return packageVersion;
  }

  // https://github.com/cnpm/cnpmjs.org/issues/415
  private async saveDeprecatedVersions(name: string, versions: PackageVersion[]) {
    console.log(name, versions);
  }

  private checkPackageVersionFormat(version: string) {
    if (!semver.valid(version)) {
      throw new UnprocessableEntityError(`version(${JSON.stringify(version)}) format invalid`);
    }
  }
}
