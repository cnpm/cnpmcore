import { PackageJson, Simplify } from 'type-fest';
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
import { BaseController } from '../type/BaseController';
import { PackageRepository } from '../../repository/PackageRepository';
import { NFSAdapter } from 'app/common/adapter/NFSAdapter';

type PackageVersion = Simplify<PackageJson.PackageJsonStandard & {
  deprecated?: 'string';
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
      content_type: 'string';
      data: 'string';
      length: number;
    };
  },
  description?: string;
  'dist-tags'?: {
    [key: string]: string;
  };
  readme?: string;
};

@HTTPController()
export class PackageController extends BaseController {
  @Inject()
  private logger: EggLogger;

  @Inject()
  private packageRepository: PackageRepository;

  @Inject()
  private nfsAdapter: NFSAdapter;

  @HTTPMethod({
    path: '/:name/:version',
    method: HTTPMethodEnum.GET,
  })
  async showVersion(@HTTPParam() name: string, @HTTPParam() version: string) {
    return this.packageRepository.findPackageVersion(null, name, version);
  }

  // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#publish-a-new-package
  @HTTPMethod({
    path: '/:name',
    method: HTTPMethodEnum.PUT,
  })
  async saveVersion(@Context() ctx: EggContext, @HTTPBody() pkg: FullPackage) {
    console.log(this.nfsAdapter);
    ctx.validate(FullPackageRule, pkg);
    const versions = Object.values(pkg.versions);
    if (versions.length === 0) {
      ctx.throw(422, 'versions is empty', {
        code: 'invalid_param',
      });
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
      ctx.throw(422, '_attachments is empty', {
        code: 'invalid_param',
      });
    }

    // handle add new version
    const version = versions[0];
    const attachment = attachments[attachmentFilename];
    const distTags = pkg['dist-tags'] ?? {};
    const distTagsNames = Object.keys(distTags);
    if (distTagsNames.length === 0) {
      ctx.throw(422, 'dist-tags is empty', {
        code: 'invalid_param',
      });
    }

    // make sure publisher in maintainers
    const tarballBuffer = Buffer.from(attachment.data, 'base64');
    if (tarballBuffer.length !== attachment.length) {
      ctx.throw(422, `attachment size ${attachment.length} not match download size ${tarballBuffer.length}`, {
        code: 'invalid_param',
      });
    }

    // check integrity or shasum
    const originDist = version.dist;
    let shasum: string;
    let integrity = originDist?.integrity as string;
    // for content security reason
    // check integrity
    if (integrity) {
      const algorithm = ssri.checkData(tarballBuffer, integrity);
      if (!algorithm) {
        ctx.throw(422, 'dist.integrity invalid', {
          code: 'invalid_param',
        });
      }
      const integrityObj = ssri.fromData(tarballBuffer, {
        algorithms: [ 'sha1' ],
      });
      shasum = integrityObj.sha1[0].hexDigest();
    } else {
      const integrityObj = ssri.fromData(tarballBuffer, {
        algorithms: [ 'sha512', 'sha1' ],
      });
      integrity = integrityObj.sha512[0].toString();
      shasum = integrityObj.sha1[0].hexDigest();
      if (originDist?.shasum && originDist?.shasum !== shasum) {
        // if integrity not exists, check shasum
        ctx.throw(422, 'dist.shasum invalid', {
          code: 'invalid_param',
        });
      }
    }

    const options = {
      // key: this.nfsAdapter.getCDNKey(pkg.name, attachmentFilename),
      shasum,
      integrity,
    };
    const uploadResult = await this.nfsAdapter.uploadBuffer(tarballBuffer, options);
    this.logger.debug('upload %j, options: %j', uploadResult, options);
    const dist = {
      ...originDist,
      key: undefined,
      tarball: undefined,
      integrity,
      shasum,
      size: attachment.length,
    };
    ctx.logger.debug(dist);

    // if nfs upload return a key, record it
    // if (uploadResult.url) {
    //   dist.tarball = uploadResult.url;
    // } else if (uploadResult.key) {
    //   dist.key = uploadResult.key;
    //   dist.tarball = uploadResult.key;
    // }

    // make sure the latest version exists

    ctx.status = 201;
    return {
      ok: true,
      rev: '1',
    };
  }

  // https://github.com/cnpm/cnpmjs.org/issues/415
  private async saveDeprecatedVersions(name: string, versions: PackageVersion[]) {
    console.log(name, versions);
  }
}
