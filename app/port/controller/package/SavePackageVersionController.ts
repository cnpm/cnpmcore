import { PackageJson, Simplify } from 'type-fest';
import {
  UnprocessableEntityError,
  NotFoundError,
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
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { Package as PackageEntity } from '../../../core/entity/Package';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import {
  VersionRule,
  TagWithVersionRule,
  Name as NameType,
  Description as DescriptionType,
} from '../../typebox';

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

// base64 regex https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
const PACKAGE_ATTACH_DATA_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@HTTPController()
export class SavePackageVersionController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#publish-a-new-package
  // https://github.com/npm/libnpmpublish/blob/main/publish.js#L43
  @HTTPMethod({
    // PUT /:fullname
    // https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
    path: `/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.PUT,
  })
  async save(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() pkg: FullPackage) {
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
}
