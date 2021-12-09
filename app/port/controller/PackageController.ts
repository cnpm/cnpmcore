import { PackageJson, Simplify } from 'type-fest';
import {
  UnprocessableEntityError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'egg-errors';
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
import * as ssri from 'ssri';
import validateNpmPackageName from 'validate-npm-package-name';
import { Static, Type } from '@sinclair/typebox';
import { AbstractController } from './AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../common/PackageUtil';
import { User as UserEntity } from '../../core/entity/User';
import { Package as PackageEntity } from '../../core/entity/Package';
import { PackageManagerService } from '../../core/service/PackageManagerService';
import {
  VersionRule,
  TagWithVersionRule,
  Name as NameType,
  Description as DescriptionType,
} from '../typebox';

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

const FullPackageRule = Type.Object({
  name: NameType,
  // Since we don't validate versions & _attachments previous, here we use Type.Any() just for object validate
  versions: Type.Optional(Type.Any()),
  _attachments: Type.Optional(Type.Any()),
  description: Type.Optional(DescriptionType),
  'dist-tags': Type.Optional(Type.Record(Type.String(), Type.String())),
  readme: Type.Optional(Type.String({ transform: [ 'trim' ] })),
});
// overwrite versions & _attachments
type FullPackage = Omit<Static<typeof FullPackageRule>, 'versions' | '_attachments'> &
{ versions: { [key: string]: PackageVersion } } &
{ _attachments: {
  [key: string]: {
    content_type: string;
    data: string;
    length: number;
  };
}};

const UpdatePacakgeDataRule = Type.Object({
  _id: Type.String({ minLength: 1, maxLength: 100 }),
  _rev: Type.String({ minLength: 1, maxLength: 100 }),
  maintainers: Type.Array(Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    email: Type.String({ format: 'email', maxLength: 400 }),
  }), { minItems: 1 }),
});
type UpdatePacakgeData = Static<typeof UpdatePacakgeDataRule>;

// https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
const PACKAGE_NAME_PATH = `/:fullname(${FULLNAME_REG_STRING})`;
const PACKAGE_NAME_WITH_VERSION_PATH = `${PACKAGE_NAME_PATH}/:version`;
const PACKAGE_TAR_DOWNLOAD_PATH = `${PACKAGE_NAME_PATH}/-/:filenameWithVersion.tgz`;
// base64 regex https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@HTTPController()
export class PackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  @HTTPMethod({
    // GET /:fullname
    path: PACKAGE_NAME_PATH,
    method: HTTPMethodEnum.GET,
  })
  async showPackage(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
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
      this.packageManagerService.readDistBytesToString(packageVersion.readmeDist),
    ]);
    packageVersionJson.readme = readme;
    return packageVersionJson;
  }

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#publish-a-new-package
  // https://github.com/npm/libnpmpublish/blob/main/publish.js#L43
  @HTTPMethod({
    // PUT /:fullname
    path: PACKAGE_NAME_PATH,
    method: HTTPMethodEnum.PUT,
  })
  async saveVersion(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() pkg: FullPackage) {
    ctx.tValidate(FullPackageRule, pkg);
    fullname = fullname.trim();
    if (fullname !== pkg.name) {
      throw new UnprocessableEntityError(`fullname(${fullname}) not match package.name(${pkg.name})`);
    }
    // Using https://github.com/npm/validate-npm-package-name to validate package name
    const validateResult = validateNpmPackageName(pkg.name);
    if (!validateResult.validForNewPackages) {
      const errors = (validateResult.errors || validateResult.warnings).join(', ');
      throw new UnprocessableEntityError(`package.name invalid, errors: ${errors}`);
    }
    const versions = Object.values(pkg.versions);
    if (versions.length === 0) {
      throw new UnprocessableEntityError('versions is empty');
    }

    // auth maintainter
    const attachments = pkg._attachments ?? {};
    const attachmentFilename = Object.keys(attachments)[0];

    if (!attachmentFilename) {
      // `deprecated: ''` meaning remove deprecated message
      const isDeprecatedRequest = versions.some(version => 'deprecated' in version);
      // handle deprecated request
      // PUT /:fullname?write=true
      // https://github.com/npm/cli/blob/latest/lib/commands/deprecate.js#L48
      if (isDeprecatedRequest) {
        return await this.saveDeprecatedVersions(ctx, pkg.name, versions);
      }

      // invalid attachments
      throw new UnprocessableEntityError('_attachments is empty');
    }

    // handle add new version
    const packageVersion = versions[0];
    // check version format
    ctx.tValidate(VersionRule, packageVersion);

    const attachment = attachments[attachmentFilename];
    const distTags = pkg['dist-tags'] ?? {};
    const tagName = Object.keys(distTags)[0];
    if (!tagName) {
      throw new UnprocessableEntityError('dist-tags is empty');
    }
    const tagWithVersion = { tag: tagName, version: distTags[tagName] };
    ctx.tValidate(TagWithVersionRule, tagWithVersion);
    if (tagWithVersion.version !== packageVersion.version) {
      throw new UnprocessableEntityError(`dist-tags version "${tagWithVersion.version}" not match package version "${packageVersion.version}"`);
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

    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
    const [ scope, name ] = getScopeAndName(fullname);
    // check scope white list
    await this.userRoleManager.requiredPackageScope(scope, authorizedUser);

    // FIXME: maybe better code style?
    let existsPackage: PackageEntity | null = null;
    try {
      existsPackage = await this.getPackageEntityByFullname(fullname);
    } catch (err) {
      if (err instanceof NotFoundError) {
        existsPackage = null;
      }
    }
    if (existsPackage) {
      await this.userRoleManager.requiredPackageMaintainer(existsPackage, authorizedUser);
    }

    // make sure readme is string
    const readme = typeof packageVersion.readme === 'string' ? packageVersion.readme : '';
    // remove readme
    packageVersion.readme = undefined;
    // make sure description is string
    if (typeof packageVersion.description !== 'string') {
      packageVersion.description = '';
    }
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
      tag: tagWithVersion.tag,
      isPrivate: true,
    }, authorizedUser);
    this.logger.info('[package:version:add] %s@%s, packageVersionId: %s, tag: %s, userId: %s',
      packageVersion.name, packageVersion.version, packageVersionEntity.packageVersionId,
      tagWithVersion.tag, authorizedUser.userId);
    ctx.status = 201;
    return {
      ok: true,
      rev: `${packageVersionEntity.id}-${packageVersionEntity.packageVersionId}`,
    };
  }

  // https://github.com/cnpm/cnpmjs.org/issues/415
  private async saveDeprecatedVersions(ctx: EggContext, fullname: string, versions: PackageVersion[]) {
    const pkg = await this.getPackageEntityAndRequiredMaintainer(ctx, fullname);

    await this.packageManagerService.saveDeprecatedVersions(pkg, versions.map(v => {
      return { version: v.version, deprecated: v.deprecated! };
    }));
    return { ok: true };
  }

  // https://github.com/npm/cli/blob/latest/lib/commands/owner.js#L191
  @HTTPMethod({
    // PUT /:fullname/-rev/:rev
    path: `${PACKAGE_NAME_PATH}/-rev/:rev`,
    method: HTTPMethodEnum.PUT,
  })
  async updatePackage(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() data: UpdatePacakgeData) {
    const npmCommand = ctx.get('npm-command');
    if (npmCommand === 'unpublish') {
      // ignore it
      return { ok: false };
    }
    ctx.tValidate(UpdatePacakgeDataRule, data);
    const pkg = await this.getPackageEntityAndRequiredMaintainer(ctx, fullname);
    // make sure all maintainers exists
    const users: UserEntity[] = [];
    for (const maintainer of data.maintainers) {
      const user = await this.userRepository.findUserByName(maintainer.name);
      if (!user) {
        throw new UnprocessableEntityError(`Maintainer "${maintainer.name}" not exists`);
      }
      users.push(user);
    }
    await this.packageManagerService.replacePackageMaintainers(pkg, users);
    return { ok: true };
  }

  @HTTPMethod({
    // GET /:fullname/-/:filenameWithVersion.tgz
    path: PACKAGE_TAR_DOWNLOAD_PATH,
    method: HTTPMethodEnum.GET,
  })
  async downloadVersionTar(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const pkg = await this.getPackageEntityByFullname(fullname);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    ctx.logger.info('[PackageController:downloadVersionTar] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    const urlOrStream = await this.packageManagerService.downloadPackageVersionTar(packageVersion);
    if (!urlOrStream) {
      throw new NotFoundError(`"${filenameWithVersion}" not exists`);
    }
    if (typeof urlOrStream === 'string') {
      ctx.redirect(urlOrStream);
      return;
    }
    ctx.attachment(`${filenameWithVersion}.tgz`);
    return urlOrStream;
  }

  // https://github.com/npm/cli/blob/latest/lib/commands/unpublish.js#L101
  // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L43
  @HTTPMethod({
    // DELETE /@cnpm/foo/-/foo-4.0.0.tgz/-rev/61af62d6295fcbd9f8f1c08f
    // DELETE /:fullname/-/:filenameWithVersion.tgz/-rev/:rev
    path: `${PACKAGE_TAR_DOWNLOAD_PATH}/-rev/:rev`,
    method: HTTPMethodEnum.DELETE,
  })
  async removeVersion(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() filenameWithVersion: string) {
    const npmCommand = ctx.get('npm-command');
    if (npmCommand !== 'unpublish') {
      throw new BadRequestError('Only allow "unpublish" npm-command');
    }
    const pkg = await this.getPackageEntityAndRequiredMaintainer(ctx, fullname);
    const version = this.getAndCheckVersionFromFilename(ctx, fullname, filenameWithVersion);
    const packageVersion = await this.getPackageVersionEntity(pkg, version);
    // https://docs.npmjs.com/policies/unpublish
    // can unpublish anytime within the first 72 hours after publishing
    if (Date.now() - packageVersion.publishTime.getTime() >= 3600000 * 72) {
      throw new ForbiddenError(`${pkg.fullname}@${version} unpublish is not allowed after 72 hours of released`);
    }
    ctx.logger.info('[PackageController:removeVersion] %s@%s, packageVersionId: %s',
      pkg.fullname, version, packageVersion.packageVersionId);
    await this.packageManagerService.removePackageVersion(pkg, packageVersion);
    return { ok: true };
  }

  private getAndCheckVersionFromFilename(ctx: EggContext, fullname: string, filenameWithVersion: string) {
    const scopeAndName = getScopeAndName(fullname);
    const name = scopeAndName[1];
    // @foo/bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    // bar/-/bar-1.0.0 == filename: bar ==> 1.0.0
    const version = filenameWithVersion.substring(name.length + 1);
    // check version format
    const data = { version };
    ctx.tValidate(VersionRule, data);
    return data.version;
  }
}
