import { AccessLevel, ContextProto, EventBus, Inject } from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';
import { NFSAdapter } from 'app/common/adapter/NFSAdapter';
import { calculateIntegrity } from 'app/common/PackageUtil';
import { PackageRepository } from 'app/repository/PackageRepository';
import { Package } from '../entity/Package';
import { PackageVersion } from '../entity/PackageVersion';
import { PackageTag } from '../entity/PackageTag';
import { PACKAGE_PUBLISHED } from '../event';

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  scope?: string;
  name: string;
  version: string;
  packageJson: any;
  readme: string;
  dist: {
    content: Uint8Array;
    meta?: object;
  };
  tag?: string;
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageManagerService {
  @Inject()
  private readonly eventBus: EventBus;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  async publish(cmd: PublishPackageCmd) {
    let pkg = await this.packageRepository.findPackage(cmd.scope, cmd.name);
    if (!pkg) {
      pkg = Package.create({
        scope: cmd.scope,
        name: cmd.name,
        isPrivate: true,
      });
      await this.packageRepository.createPackage(pkg);
    }
    if (!pkg.isPrivate) {
      throw new ForbiddenError('npm public package can\'t be publish');
    }

    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#abbreviated-version-object
    let hasInstallScript;
    const scripts = cmd.packageJson.scripts;
    if (scripts) {
      // https://www.npmjs.com/package/fix-has-install-script
      if (scripts.install || scripts.preinstall || scripts.postinstall) {
        hasInstallScript = true;
      }
    }
    const abbreviated = JSON.stringify({
      name: cmd.packageJson.name,
      version: cmd.packageJson.version,
      deprecated: cmd.packageJson.deprecated,
      dependencies: cmd.packageJson.dependencies,
      optionalDependencies: cmd.packageJson.optionalDependencies,
      devDependencies: cmd.packageJson.devDependencies,
      bundleDependencies: cmd.packageJson.bundleDependencies,
      peerDependencies: cmd.packageJson.peerDependencies,
      bin: cmd.packageJson.bin,
      os: cmd.packageJson.os,
      cpu: cmd.packageJson.cpu,
      workspaces: cmd.packageJson.workspaces,
      directories: cmd.packageJson.directories,
      dict: cmd.packageJson.bin,
      engines: cmd.packageJson.engines,
      _hasShrinkwrap: cmd.packageJson._hasShrinkwrap,
      hasInstallScript,
    });

    const tarDistBytes = cmd.dist.content;
    const tarDistIntegrity = calculateIntegrity(tarDistBytes);
    const readmeDistBytes = Buffer.from(cmd.readme);
    const readmeDistIntegrity = calculateIntegrity(readmeDistBytes);
    const manifestDistBytes = Buffer.from(JSON.stringify(cmd.packageJson));
    const manifestDistIntegrity = calculateIntegrity(manifestDistBytes);
    const pkgVersion = PackageVersion.create({
      packageId: pkg.packageId,
      publishTime: new Date(),
      manifestDist: pkg.createManifest(cmd.version, {
        size: manifestDistBytes.length,
        shasum: manifestDistIntegrity.shasum,
        integrity: manifestDistIntegrity.integrity,
      }),
      readmeDist: pkg.createReadme(cmd.version, {
        size: readmeDistBytes.length,
        shasum: readmeDistIntegrity.shasum,
        integrity: readmeDistIntegrity.integrity,
      }),
      tarDist: pkg.createTar(cmd.version, {
        size: tarDistBytes.length,
        shasum: tarDistIntegrity.shasum,
        integrity: tarDistIntegrity.integrity,
      }),
      version: cmd.version,
      abbreviated,
    });
    await Promise.all([
      this.nfsAdapter.uploadBytes(pkgVersion.manifestDist.path, manifestDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.readmeDist.path, readmeDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.tarDist.path, tarDistBytes),
    ]);
    await this.packageRepository.createPackageVersion(pkgVersion);
    this.eventBus.emit(PACKAGE_PUBLISHED, pkgVersion.packageVersionId);
    if (cmd.tag) {
      // TODO: change package tag
      const tag = PackageTag.create({
        packageId: pkg.packageId,
        tag: cmd.tag,
        version: cmd.version,
      });
      await this.packageRepository.savePackageTag(tag);
    }
    return pkgVersion.packageVersionId;
  }
}
