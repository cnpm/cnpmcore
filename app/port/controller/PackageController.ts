import { HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam, Inject } from '@eggjs/tegg';
import { PackageRepository } from '../../repository/PackageRepository';

@HTTPController()
export class PackageController {
  @Inject()
  private packageRepository: PackageRepository;

  @HTTPMethod({
    path: '/:name/:version',
    method: HTTPMethodEnum.GET,
  })
  async showVersion(@HTTPParam() name: string, @HTTPParam() version: string) {
    return this.packageRepository.findPackageVersion(null, name, version);
  }
}
