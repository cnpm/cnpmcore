import { stat } from 'node:fs/promises';
import { AccessLevel, ContextProto, EventBus, Inject } from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';
import { RequireAtLeastOne } from 'type-fest';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { calculateIntegrity } from '../../common/PackageUtil';
import { PackageRepository } from '../../repository/PackageRepository';
import { Package } from '../entity/Package';
import { PackageVersion } from '../entity/PackageVersion';
import { PackageTag } from '../entity/PackageTag';
import {
  PACKAGE_PUBLISHED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_ADDED,
} from '../event';
import { Dist } from '../entity/Dist';

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  scope?: string;
  name: string;
  version: string;
  description: string;
  packageJson: any;
  readme: string;
  // require content or localFile field
  dist: RequireAtLeastOne<{
    // package controller will use content field
    content?: Uint8Array;
    // sync worker will use localFile field
    localFile?: string;
    meta?: object;
  }, 'content' | 'localFile'>;
  tag?: string;
  isPrivate: boolean;
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

  // support user publish private package and sync worker publish public package
  async publish(cmd: PublishPackageCmd) {
    let pkg = await this.packageRepository.findPackage(cmd.scope, cmd.name);
    if (!pkg) {
      pkg = Package.create({
        scope: cmd.scope,
        name: cmd.name,
        isPrivate: cmd.isPrivate,
        description: cmd.description,
      });
      await this.packageRepository.createPackage(pkg);
    } else {
      // update description
      // will read database twice to update description by model to entity and entity to model
      if (pkg.description !== cmd.description) {
        pkg.description = cmd.description;
        await this.packageRepository.savePackage(pkg);
      }
    }

    let pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, cmd.version);
    if (pkgVersion) {
      throw new ForbiddenError(`cannot modify pre-existing version: ${pkgVersion.version}`);
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
    const abbreviatedDistBytes = Buffer.from(abbreviated);
    const abbreviatedDistIntegrity = await calculateIntegrity(abbreviatedDistBytes);
    const readmeDistBytes = Buffer.from(cmd.readme);
    const readmeDistIntegrity = await calculateIntegrity(readmeDistBytes);
    const manifestDistBytes = Buffer.from(JSON.stringify(cmd.packageJson));
    const manifestDistIntegrity = await calculateIntegrity(manifestDistBytes);

    let tarDistIntegrity: any;
    let tarDistSize = 0;
    if (cmd.dist.content) {
      const tarDistBytes = cmd.dist.content;
      tarDistIntegrity = await calculateIntegrity(tarDistBytes);
      tarDistSize = tarDistBytes.length;
    } else if (cmd.dist.localFile) {
      const localFile = cmd.dist.localFile;
      const fileStat = await stat(localFile);
      tarDistIntegrity = await calculateIntegrity(localFile);
      tarDistSize = fileStat.size;
    }
    const tarDist = pkg.createTar(cmd.version, {
      size: tarDistSize,
      shasum: tarDistIntegrity.shasum,
      integrity: tarDistIntegrity.integrity,
    });
    if (cmd.dist.content) {
      await this.nfsAdapter.uploadBytes(tarDist.path, cmd.dist.content);
    } else if (cmd.dist.localFile) {
      await this.nfsAdapter.uploadFile(tarDist.path, cmd.dist.localFile);
    }

    pkgVersion = PackageVersion.create({
      packageId: pkg.packageId,
      version: cmd.version,
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
      abbreviatedDist: pkg.createAbbreviated(cmd.version, {
        size: abbreviatedDistBytes.length,
        shasum: abbreviatedDistIntegrity.shasum,
        integrity: abbreviatedDistIntegrity.integrity,
      }),
      tarDist,
    });
    await Promise.all([
      this.nfsAdapter.uploadBytes(pkgVersion.abbreviatedDist.path, abbreviatedDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.manifestDist.path, manifestDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.readmeDist.path, readmeDistBytes),
    ]);
    await this.packageRepository.createPackageVersion(pkgVersion);
    this.eventBus.emit(PACKAGE_PUBLISHED, pkgVersion.packageVersionId);
    if (cmd.tag) {
      await this.savePackageTag(pkg.packageId, cmd.tag, cmd.version);
    }
    return pkgVersion;
  }

  private async savePackageTag(packageId: string, tag: string, version: string) {
    let tagEntity = await this.packageRepository.findPackageTag(packageId, tag);
    if (!tagEntity) {
      tagEntity = PackageTag.create({
        packageId,
        tag,
        version,
      });
      await this.packageRepository.savePackageTag(tagEntity);
      this.eventBus.emit(PACKAGE_TAG_ADDED, tagEntity.packageTagId);
      return;
    }
    if (tagEntity.version === version) {
      // nothing change
      return;
    }
    tagEntity.version = version;
    await this.packageRepository.savePackageTag(tagEntity);
    this.eventBus.emit(PACKAGE_TAG_CHANGED, tagEntity.packageTagId);
  }

  async listPackageManifests(scope: string, name: string) {
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) return null;
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    return {
      _attachments: {},
      _id: `${pkg.name}`,
      _rev: `${pkg.id}-${pkg.packageId}`,
      author: {},
      description: '',
      'dist-tags': {},
      license: '',
      maintainers: [],
      name: pkg.name,
      readme: '',
      readmeFilename: '',
      time: {
        '1.0.0': '',
        created: pkg.gmtCreate,
        modified: pkg.gmtModified,
      },
      versions: {},
    };
  }

  async readDistBytesToJSON(dist: Dist): Promise<object> {
    const bytes = await this.readDistBytes(dist);
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  }

  async readDistBytes(dist: Dist): Promise<Uint8Array> {
    return await this.nfsAdapter.getBytes(dist.path);
  }
}
