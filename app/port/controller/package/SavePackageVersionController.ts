import { PackageJson, Simplify } from 'type-fest';
import { isEqual } from 'lodash';
import {
  UnprocessableEntityError,
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
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING, extractPackageJSON } from '../../../common/PackageUtil';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import {
  VersionRule,
  TagWithVersionRule,
  Name as NameType,
  Description as DescriptionType,
} from '../../typebox';
import { RegistryManagerService } from '../../../core/service/RegistryManagerService';
import { PackageJSONType } from '../../../repository/PackageRepository';

const STRICT_CHECK_TARBALL_FIELDS: (keyof PackageJson)[] = [ 'name', 'version', 'scripts', 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'license', 'licenses', 'bin' ];

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
const PACKAGE_ATTACH_DATA_RE = /^[A-Za-z0-9+/]{4}/;

@HTTPController()
export class SavePackageVersionController extends AbstractController {
  @Inject()
  private readonly packageManagerService: PackageManagerService;

  @Inject()
  private readonly registryManagerService: RegistryManagerService;

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#publish-a-new-package
  // https://github.com/npm/libnpmpublish/blob/main/publish.js#L43
  @HTTPMethod({
    // PUT /:fullname
    // https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
    path: `/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.PUT,
  })
  async save(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() pkg: FullPackage) {
    this.validateNpmCommand(ctx);
    ctx.tValidate(FullPackageRule, pkg);
    const { user } = await this.ensurePublishAccess(ctx, fullname, false);
    fullname = fullname.trim();
    if (fullname !== pkg.name) {
      throw new UnprocessableEntityError(`fullname(${fullname}) not match package.name(${pkg.name})`);
    }

    // Using https://github.com/npm/validate-npm-package-name to validate package name
    const validateResult = validateNpmPackageName(pkg.name);
    if (!validateResult.validForNewPackages) {
      // if pkg already exists, still allow to publish
      const [ scope, name ] = getScopeAndName(fullname);
      const pkg = await this.packageRepository.findPackage(scope, name);
      if (!pkg) {
        const errors = (validateResult.errors || validateResult.warnings).join(', ');
        throw new UnprocessableEntityError(`package.name invalid, errors: ${errors}`);
      }
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
        return await this.saveDeprecatedVersions(pkg.name, versions);
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
    if (!attachment.data || typeof attachment.data !== 'string') {
      throw new UnprocessableEntityError('attachment.data format invalid');
    }
    if (!PACKAGE_ATTACH_DATA_RE.test(attachment.data)) {
      throw new UnprocessableEntityError('attachment.data string format invalid');
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

    // https://github.com/cnpm/cnpmcore/issues/542
    // check tgz & manifests
    if (this.config.cnpmcore.strictValidateTarballPkg) {
      const tarballPkg = await extractPackageJSON(tarballBytes);
      const versionManifest = pkg.versions[tarballPkg.version];
      const diffKeys = STRICT_CHECK_TARBALL_FIELDS.filter(key => {
        return !isEqual(tarballPkg[key], versionManifest[key]);
      });
      if (diffKeys.length > 0) {
        throw new UnprocessableEntityError(`${diffKeys} mismatch between tarball and manifest`);
      }
    }

    const [ scope, name ] = getScopeAndName(fullname);

    // make sure readme is string
    const readme = typeof packageVersion.readme === 'string' ? packageVersion.readme : '';
    // remove readme
    packageVersion.readme = undefined;
    // make sure description is string
    if (typeof packageVersion.description !== 'string') {
      packageVersion.description = '';
    }

    const registry = await this.registryManagerService.ensureSelfRegistry();
    const packageVersionEntity = await this.packageManagerService.publish({
      scope,
      name,
      version: packageVersion.version,
      description: packageVersion.description,
      packageJson: packageVersion as PackageJSONType,
      readme,
      dist: {
        content: tarballBytes,
      },
      tag: tagWithVersion.tag,
      registryId: registry.registryId,
      isPrivate: true,
    }, user);

    this.logger.info('[package:version:add] %s@%s, packageVersionId: %s, tag: %s, userId: %s',
      packageVersion.name, packageVersion.version, packageVersionEntity.packageVersionId,
      tagWithVersion.tag, user.userId);
    ctx.status = 201;
    return {
      ok: true,
      rev: `${packageVersionEntity.id}-${packageVersionEntity.packageVersionId}`,
    };
  }

  // https://github.com/cnpm/cnpmjs.org/issues/415
  private async saveDeprecatedVersions(fullname: string, versions: PackageVersion[]) {
    const pkg = await this.getPackageEntityByFullname(fullname);
    await this.packageManagerService.saveDeprecatedVersions(pkg, versions.map(v => {
      return { version: v.version, deprecated: v.deprecated! };
    }));
    return { ok: true };
  }

  private validateNpmCommand(ctx: EggContext) {
    // forbidden star/unstar request
    // npm@6: referer: 'star [REDACTED]'
    // npm@>=7: 'npm-command': 'star'
    let command = ctx.get('npm-command');
    if (!command) {
      command = ctx.get('referer').split(' ', 1)[0];
    }
    if (command === 'star' || command === 'unstar') {
      throw new ForbiddenError(`npm ${command} is not allowed`);
    }
  }
}
