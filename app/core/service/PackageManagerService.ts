import { AccessLevel, ContextProto, EventBus, Inject } from '@eggjs/tegg';
import { PackageRepository } from '../../repository/PackageRepository';
import { Package } from '../entity/Package';
import { PackageVersion } from '../entity/PackageVersion';
import { PACKAGE_PUBLISHED } from '../events';

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  name: string;
  version: string;
  distTag: string;
  packageJson: object;
  dist: Buffer;
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageManagerService {
  @Inject()
  private readonly eventBus: EventBus;

  @Inject()
  private readonly packageRepository: PackageRepository;

  async publish(cmd: PublishPackageCmd) {
    const pkg = Package.create({
      name: cmd.name,
      isPrivate: true,
    });
    await this.packageRepository.createPackage(pkg);
    const pkgVersion = PackageVersion.create({
      packageId: pkg.packageId,
      publishTime: new Date(),
      manifestDist: pkg.createManifest(cmd.version, {
        size: 0,
        shasum: '',
      }),
      readmeDist: pkg.createReadme(cmd.version, {
        size: 0,
        shasum: '',
      }),
      tarDist: pkg.createTar(cmd.version, {
        size: 0,
        shasum: '',
      }),
      version: cmd.version,
    });
    await this.packageRepository.createPackageVersion(pkgVersion);
    this.eventBus.emit(PACKAGE_PUBLISHED, pkgVersion.packageVersionId);
    return pkgVersion.packageVersionId;
  }
}
