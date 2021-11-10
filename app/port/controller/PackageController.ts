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
import { BaseController } from '../type/BaseController';
import { PackageRepository } from '../../repository/PackageRepository';

type PackageVersion = Simplify<PackageJson.PackageJsonStandard & { deprecated?: 'string' }>;

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
  private packageRepository: PackageRepository;

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
      const isDeprecatedRequest = versions.some((version) => !!version.deprecated);
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
    console.log(version);

    ctx.status = 201;
    return {
      ok: true,
      rev: '1',
    };
  }

  private async saveDeprecatedVersions(name: string, versions: PackageVersion[]) {
    console.log(name, versions);
  }
}
