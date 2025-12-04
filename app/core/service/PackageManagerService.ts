import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import { JSONBuilder } from '@cnpmjs/packument';
import { AccessLevel, Inject, SingletonProto, type EventBus } from 'egg';
import { BadRequestError, ForbiddenError, NotFoundError } from 'egg/errors';
import npa from 'npm-package-arg';
import pMap from 'p-map';
import semver from 'semver';
import type { RequireAtLeastOne } from 'type-fest';

import { AbstractService } from '../../common/AbstractService.ts';
import {
  calculateIntegrity,
  type Integrity,
  detectInstallScript,
  formatTarball,
  getFullname,
  getScopeAndName,
  hasShrinkWrapInTgz,
} from '../../common/PackageUtil.ts';
import type { DistRepository } from '../../repository/DistRepository.ts';
import type {
  AbbreviatedPackageJSONType,
  AbbreviatedPackageManifestType,
  AuthorType,
  PackageJSONType,
  PackageManifestType,
  PackageRepository,
} from '../../repository/PackageRepository.ts';
import type { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';
import { isDuplicateKeyError } from '../../repository/util/ErrorUtil.ts';
import type { BugVersion } from '../entity/BugVersion.ts';
import type { Dist } from '../entity/Dist.ts';
import { Package } from '../entity/Package.ts';
import { PackageTag } from '../entity/PackageTag.ts';
import { PackageVersion } from '../entity/PackageVersion.ts';
import { PackageVersionBlock } from '../entity/PackageVersionBlock.ts';
import type { Registry } from '../entity/Registry.ts';
import type { User } from '../entity/User.ts';
import {
  PACKAGE_ADDED,
  PACKAGE_BLOCKED,
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_META_CHANGED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
  PACKAGE_UNBLOCKED,
  PACKAGE_UNPUBLISHED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
} from '../event/index.ts';
import type { BugVersionService } from './BugVersionService.ts';
import type { PackageVersionService } from './PackageVersionService.ts';
import type { RegistryManagerService } from './RegistryManagerService.ts';

const TOTAL = '@@TOTAL@@';
const SCOPE_TOTAL_PREFIX = '@@SCOPE@@:';
const DESCRIPTION_LIMIT = 1024 * 10;

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  scope: string;
  // name don't include scope
  name: string;
  version: string;
  description?: string;
  packageJson: PackageJSONType;
  registryId?: string;
  readme: string;
  // require content or localFile field
  dist: RequireAtLeastOne<
    {
      // package controller will use content field
      content?: Uint8Array;
      // sync worker will use localFile field
      localFile?: string;
    },
    'content' | 'localFile'
  >;
  tags?: string[];
  isPrivate: boolean;
  // only use on sync package
  publishTime?: Date;
  // only use on sync package for speed up https://github.com/cnpm/cnpmcore/issues/28
  skipRefreshPackageManifests?: boolean;
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageManagerService extends AbstractService {
  @Inject()
  private readonly eventBus: EventBus;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly packageVersionBlockRepository: PackageVersionBlockRepository;
  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;
  @Inject()
  private readonly bugVersionService: BugVersionService;
  @Inject()
  private readonly distRepository: DistRepository;
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly packageVersionService: PackageVersionService;

  private static downloadCounters = {};

  // support user publish private package and sync worker publish public package
  async publish(cmd: PublishPackageCmd, publisher: User) {
    if (this.config.cnpmcore.strictValidatePackageDeps) {
      await this._checkPackageDepsVersion(cmd.packageJson);
    }
    let pkg = await this.packageRepository.findPackage(cmd.scope, cmd.name);
    let isNewPackage = !pkg;
    if (pkg) {
      // update description
      // will read database twice to update description by model to entity and entity to model
      if (pkg.description !== cmd.description) {
        pkg.description = cmd.description || '';
      }

      /* c8 ignore next 3 */
      // package can be migrated into another registry
      if (cmd.registryId) {
        pkg.registryId = cmd.registryId;
      }
    } else {
      pkg = Package.create({
        scope: cmd.scope,
        name: cmd.name,
        isPrivate: cmd.isPrivate,
        description: cmd.description || '',
        registryId: cmd.registryId,
      });
    }

    // 防止 description 长度超过 db 限制
    if (pkg.description?.length > DESCRIPTION_LIMIT) {
      pkg.description = pkg.description.slice(0, DESCRIPTION_LIMIT);
    }
    await this.packageRepository.savePackage(pkg);
    // create maintainer
    await this.packageRepository.savePackageMaintainer(pkg.packageId, publisher.userId);

    let pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, cmd.version);
    if (pkgVersion) {
      throw new ForbiddenError(`Can't modify pre-existing version: ${pkg.fullname}@${pkgVersion.version}`);
    }

    // make sure cmd.packageJson.readme is deleted
    if ('readme' in cmd.packageJson) {
      delete cmd.packageJson.readme;
    }

    const publishTime = cmd.publishTime || new Date();

    // add _cnpmcore_publish_time field to cmd.packageJson
    if (!cmd.packageJson._cnpmcore_publish_time) {
      cmd.packageJson._cnpmcore_publish_time = publishTime;
    }
    if (!cmd.packageJson.publish_time) {
      cmd.packageJson.publish_time = publishTime.getTime();
    }
    if (cmd.packageJson._hasShrinkwrap === undefined) {
      const contentOrFile = cmd.dist.content || cmd.dist.localFile;
      if (contentOrFile) {
        cmd.packageJson._hasShrinkwrap = await hasShrinkWrapInTgz(contentOrFile);
      }
    }

    // set _npmUser field to cmd.packageJson
    cmd.packageJson._npmUser = {
      // clean user scope prefix
      name: publisher.displayName,
      email: publisher.email,
    };

    // add _registry_name field to cmd.packageJson
    const registry = await this.getSourceRegistry(pkg);
    if (registry) {
      cmd.packageJson._source_registry_name = registry.name;
    }

    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#abbreviated-version-object
    const hasInstallScript = detectInstallScript(cmd.packageJson) ? true : undefined;
    let tarDistIntegrity: Integrity;
    let tarDistSize = 0;
    if (cmd.dist.content) {
      const tarDistBytes = cmd.dist.content;
      tarDistIntegrity = await calculateIntegrity(tarDistBytes);
      tarDistSize = tarDistBytes.length;
    } else {
      // should has localFile
      const localFile = cmd.dist.localFile as string;
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
      await this.distRepository.saveDist(tarDist, cmd.dist.content);
    } else if (cmd.dist.localFile) {
      await this.distRepository.saveDist(tarDist, cmd.dist.localFile);
    }

    cmd.packageJson.dist = {
      ...cmd.packageJson.dist,
      tarball: formatTarball(this.config.cnpmcore.registry, pkg.scope, pkg.name, cmd.version),
      size: tarDistSize,
      shasum: tarDistIntegrity.shasum,
      integrity: tarDistIntegrity.integrity,
    };

    // https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md#abbreviated-version-object
    // Abbreviated version object
    const abbreviated = JSON.stringify({
      name: cmd.packageJson.name,
      version: cmd.packageJson.version,
      deprecated: cmd.packageJson.deprecated,
      dependencies: cmd.packageJson.dependencies,
      acceptDependencies: cmd.packageJson.acceptDependencies,
      optionalDependencies: cmd.packageJson.optionalDependencies,
      devDependencies: cmd.packageJson.devDependencies,
      bundleDependencies: cmd.packageJson.bundleDependencies,
      peerDependencies: cmd.packageJson.peerDependencies,
      peerDependenciesMeta: cmd.packageJson.peerDependenciesMeta,
      bin: cmd.packageJson.bin,
      directories: cmd.packageJson.directories,
      os: cmd.packageJson.os,
      cpu: cmd.packageJson.cpu,
      libc: cmd.packageJson.libc,
      workspaces: cmd.packageJson.workspaces,
      dist: cmd.packageJson.dist,
      engines: cmd.packageJson.engines,
      _hasShrinkwrap: cmd.packageJson._hasShrinkwrap,
      hasInstallScript,
      funding: cmd.packageJson.funding,
      // https://github.com/cnpm/npminstall/blob/13efc7eec21a61e509226e3772bfb75cd5605612/lib/install_package.js#L176
      // npminstall require publish time to show the recently update versions
      publish_time: cmd.packageJson.publish_time,
      _source_registry_name: cmd.packageJson._source_registry_name,
    } as AbbreviatedPackageJSONType);
    const abbreviatedDistBytes = Buffer.from(abbreviated);
    const abbreviatedDistIntegrity = await calculateIntegrity(abbreviatedDistBytes);
    const readmeDistBytes = Buffer.from(cmd.readme);
    const readmeDistIntegrity = await calculateIntegrity(readmeDistBytes);
    const manifestDistBytes = Buffer.from(JSON.stringify(cmd.packageJson));
    const manifestDistIntegrity = await calculateIntegrity(manifestDistBytes);

    pkgVersion = PackageVersion.create({
      packageId: pkg.packageId,
      version: cmd.version,
      publishTime,
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
      this.distRepository.saveDist(pkgVersion.abbreviatedDist, abbreviatedDistBytes),
      this.distRepository.saveDist(pkgVersion.manifestDist, manifestDistBytes),
      this.distRepository.saveDist(pkgVersion.readmeDist, readmeDistBytes),
    ]);
    try {
      await this.packageRepository.createPackageVersion(pkgVersion);
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        throw new ForbiddenError(`Can't modify pre-existing version: ${pkg.fullname}@${cmd.version}`);
      }
      throw e;
    }
    if (cmd.skipRefreshPackageManifests !== true) {
      await this.refreshPackageChangeVersionsToDists(pkg, [pkgVersion.version]);
    }
    if (cmd.tags) {
      for (const tag of cmd.tags) {
        await this.savePackageTag(pkg, tag, cmd.version, true);
        this.eventBus.emit(PACKAGE_VERSION_ADDED, pkg.fullname, pkgVersion.version, tag);
      }
    } else {
      this.eventBus.emit(PACKAGE_VERSION_ADDED, pkg.fullname, pkgVersion.version, undefined);
    }

    if (isNewPackage) {
      this.eventBus.emit(PACKAGE_ADDED, pkg.fullname);
    }

    return pkgVersion;
  }

  async blockPackageByFullname(name: string, reason: string) {
    const [scope, pkgName] = getScopeAndName(name);
    const pkg = await this.packageRepository.findPackage(scope, pkgName);
    if (!pkg) {
      throw new NotFoundError(`Package name(${name}) not found`);
    }
    return await this.blockPackage(pkg, reason);
  }

  async blockPackage(pkg: Package, reason: string) {
    let block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      block.reason = reason;
    } else {
      block = PackageVersionBlock.create({
        packageId: pkg.packageId,
        version: '*',
        reason,
      });
    }
    await this.packageVersionBlockRepository.savePackageVersionBlock(block);
    if (pkg.manifestsDist && pkg.abbreviatedsDist) {
      if (this.config.cnpmcore.experimental.enableJSONBuilder) {
        const fullManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.manifestsDist);
        if (fullManifestsBuilder) {
          fullManifestsBuilder.setIn(['block'], reason);
        }
        const abbreviatedManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.abbreviatedsDist);
        if (abbreviatedManifestsBuilder) {
          abbreviatedManifestsBuilder.setIn(['block'], reason);
        }
        await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, abbreviatedManifestsBuilder);
      } else {
        const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist);
        if (fullManifests) {
          fullManifests.block = reason;
        }
        const abbreviatedManifests = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageManifestType>(
          pkg.abbreviatedsDist,
        );
        if (abbreviatedManifests) {
          abbreviatedManifests.block = reason;
        }
        await this._updatePackageManifestsToDists(pkg, fullManifests || null, abbreviatedManifests || null);
      }
      this.eventBus.emit(PACKAGE_BLOCKED, pkg.fullname);
      this.logger.info('[packageManagerService.blockPackage:success] packageId: %s, reason: %j', pkg.packageId, reason);
    }
    return block;
  }

  async unblockPackageByFullname(name: string) {
    const [scope, pkgName] = getScopeAndName(name);
    const pkg = await this.packageRepository.findPackage(scope, pkgName);
    if (!pkg) {
      throw new NotFoundError(`Package name(${name}) not found`);
    }
    return await this.unblockPackage(pkg);
  }

  async unblockPackage(pkg: Package) {
    const block = await this.packageVersionBlockRepository.findPackageVersionBlock(pkg.packageId, '*');
    if (block) {
      await this.packageVersionBlockRepository.removePackageVersionBlock(block.packageVersionBlockId);
    }
    if (pkg.manifestsDist && pkg.abbreviatedsDist) {
      if (this.config.cnpmcore.experimental.enableJSONBuilder) {
        const fullManifestsBuffer = await this.distRepository.readDistBytesToBuffer(pkg.manifestsDist);
        let fullManifestsBuilder: JSONBuilder | undefined;
        if (fullManifestsBuffer) {
          fullManifestsBuilder = new JSONBuilder(fullManifestsBuffer);
          fullManifestsBuilder.deleteIn(['block']);
        }
        const abbreviatedManifestsBuffer = await this.distRepository.readDistBytesToBuffer(pkg.abbreviatedsDist);
        let abbreviatedManifestsBuilder: JSONBuilder | undefined;
        if (abbreviatedManifestsBuffer) {
          abbreviatedManifestsBuilder = new JSONBuilder(abbreviatedManifestsBuffer);
          abbreviatedManifestsBuilder.deleteIn(['block']);
        }
        await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, abbreviatedManifestsBuilder);
      } else {
        const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist);
        if (fullManifests) {
          fullManifests.block = undefined;
        }
        const abbreviatedManifests = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageManifestType>(
          pkg.abbreviatedsDist,
        );
        if (abbreviatedManifests) {
          abbreviatedManifests.block = undefined;
        }
        await this._updatePackageManifestsToDists(pkg, fullManifests || null, abbreviatedManifests || null);
      }
      this.eventBus.emit(PACKAGE_UNBLOCKED, pkg.fullname);
      this.logger.info('[packageManagerService.unblockPackage:success] packageId: %s', pkg.packageId);
    }
  }

  async replacePackageMaintainersAndDist(pkg: Package, maintainers: User[]) {
    await this.packageRepository.replacePackageMaintainers(
      pkg.packageId,
      maintainers.map((m) => m.userId),
    );
    await this.refreshPackageMaintainersToDists(pkg);
    this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.fullname, maintainers);
  }

  async savePackageMaintainers(pkg: Package, maintainers: User[]): Promise<boolean> {
    let hasNewRecord = false;
    for (const maintainer of maintainers) {
      const newRecord = await this.packageRepository.savePackageMaintainer(pkg.packageId, maintainer.userId);
      if (newRecord) {
        hasNewRecord = true;
      }
    }
    if (hasNewRecord) {
      this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.fullname, maintainers);
    }
    return hasNewRecord;
  }

  async removePackageMaintainer(pkg: Package, maintainer: User) {
    await this.packageRepository.removePackageMaintainer(pkg.packageId, maintainer.userId);
    this.eventBus.emit(PACKAGE_MAINTAINER_REMOVED, pkg.fullname, maintainer.name);
  }

  async refreshPackageMaintainersToDists(pkg: Package) {
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
  }

  async refreshPackageDistTagsToDists(pkg: Package) {
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
  }

  async listPackageFullManifests(scope: string, name: string, isSync = false) {
    return await this._listPackageFullOrAbbreviatedManifests<PackageManifestType>(scope, name, true, isSync);
  }

  async listPackageFullManifestsBuffer(scope: string, name: string) {
    return await this._listPackageFullOrAbbreviatedManifestsBuffer(scope, name, true);
  }

  async listPackageAbbreviatedManifests(scope: string, name: string, isSync = false) {
    return await this._listPackageFullOrAbbreviatedManifests(scope, name, false, isSync);
  }

  async listPackageAbbreviatedManifestsBuffer(scope: string, name: string) {
    return await this._listPackageFullOrAbbreviatedManifestsBuffer(scope, name, false);
  }

  async showPackageVersionByVersionOrTag(
    scope: string,
    name: string,
    spec: string,
  ): Promise<{
    blockReason?: string;
    pkg?: Package;
    packageVersion?: PackageVersion | null;
  }> {
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) return {};
    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      return { blockReason: block.reason, pkg };
    }
    const fullname = getFullname(scope, name);
    const result = npa(`${fullname}@${spec}`);
    const version = await this.packageVersionService.getVersion(result);
    if (!version) {
      return {};
    }
    const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
    return { packageVersion, pkg };
  }

  async showPackageVersionManifest(scope: string, name: string, spec: string, isSync = false, isFullManifests = false) {
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) return {};
    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      return { blockReason: block.reason, pkg };
    }
    const fullname = getFullname(scope, name);
    const result = npa(`${fullname}@${spec}`);
    const manifest = await this.packageVersionService.readManifest(pkg.packageId, result, isFullManifests, !isSync);
    return { manifest, blockReason: null, pkg };
  }

  async downloadPackageVersionTar(packageVersion: PackageVersion) {
    return await this.distRepository.downloadDist(packageVersion.tarDist);
  }

  public plusPackageVersionCounter(fullname: string, version: string) {
    // set counter + 1, schedule will store them into database
    const counters: Record<string, Record<string, number>> = PackageManagerService.downloadCounters;
    if (!counters[fullname]) counters[fullname] = {};
    counters[fullname][version] = (counters[fullname][version] || 0) + 1;
    // Total
    const ALL = '*';
    if (!counters[TOTAL]) counters[TOTAL] = {};
    counters[TOTAL][ALL] = (counters[TOTAL][ALL] || 0) + 1;
    // scope total
    const scope = getScopeAndName(fullname)[0];
    if (scope) {
      const scopeKey = `${SCOPE_TOTAL_PREFIX}${scope}`;
      if (!counters[scopeKey]) counters[scopeKey] = {};
      counters[scopeKey][ALL] = (counters[scopeKey][ALL] || 0) + 1;
    }
  }

  // will be call by schedule/SavePackageVersionDownloadCounter.ts
  async savePackageVersionCounters() {
    // { [fullname]: { [version]: number } }
    const counters: Record<string, Record<string, number>> = PackageManagerService.downloadCounters;
    const fullnames = Object.keys(counters);
    if (fullnames.length === 0) return;

    PackageManagerService.downloadCounters = {};
    this.logger.info('[packageManagerService.savePackageVersionCounters:saving] %d fullnames', fullnames.length);

    let total = 0;
    for (const fullname in counters) {
      const versions = counters[fullname];
      let packageId: string | null = null;
      if (fullname === TOTAL) {
        packageId = 'total';
      } else if (fullname.startsWith(SCOPE_TOTAL_PREFIX)) {
        packageId = fullname.replace(SCOPE_TOTAL_PREFIX, '');
      } else {
        // find packageId from fullname
        const [scope, name] = getScopeAndName(fullname);
        packageId = await this.packageRepository.findPackageId(scope, name);
      }
      if (!packageId) continue;

      for (const version in versions) {
        const counter = versions[version];
        await this.packageVersionDownloadRepository.plus(packageId, version, counter);
        total += counter;
      }
    }
    this.logger.info('[packageManagerService.savePackageVersionCounters:saved] %d total', total);
  }

  public async saveDeprecatedVersions(pkg: Package, deprecatedList: { version: string; deprecated?: string }[]) {
    const updateVersions: string[] = [];
    for (const { version, deprecated } of deprecatedList) {
      const pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
      if (!pkgVersion) continue;
      const message = deprecated === '' ? undefined : deprecated;
      await this._mergeManifestDist(pkgVersion.manifestDist, {
        deprecated: message,
      });
      await this._mergeManifestDist(pkgVersion.abbreviatedDist, {
        deprecated: message,
      });
      await this.packageRepository.savePackageVersion(pkgVersion);
      updateVersions.push(version);
    }
    await this.refreshPackageChangeVersionsToDists(pkg, updateVersions);
    this.eventBus.emit(PACKAGE_META_CHANGED, pkg.fullname, {
      deprecateds: deprecatedList,
    });
  }

  public async savePackageVersionManifest(pkgVersion: PackageVersion, mergeManifest: object, mergeAbbreviated: object) {
    await this._mergeManifestDist(pkgVersion.manifestDist, mergeManifest);
    await this._mergeManifestDist(pkgVersion.abbreviatedDist, mergeAbbreviated);
  }

  /**
   * save package version readme
   */
  public async savePackageVersionReadme(pkgVersion: PackageVersion, readmeFile: string) {
    await this.distRepository.saveDist(pkgVersion.readmeDist, readmeFile);
    this.logger.info(
      '[PackageManagerService.savePackageVersionReadme] save packageVersionId:%s readme:%s to dist:%s',
      pkgVersion.packageVersionId,
      readmeFile,
      pkgVersion.readmeDist.distId,
    );
  }

  public async savePackageReadme(pkg: Package, readmeFile: string) {
    if (!pkg.manifestsDist) return;

    const readme = await readFile(readmeFile, 'utf8');

    if (this.config.cnpmcore.experimental.enableJSONBuilder) {
      const fullManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.manifestsDist);
      if (!fullManifestsBuilder) return;

      fullManifestsBuilder.setIn(['readme'], readme);
      await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, undefined);
    } else {
      const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist);
      if (!fullManifests) return;

      fullManifests.readme = readme;
      await this._updatePackageManifestsToDists(pkg, fullManifests, null);
    }

    this.logger.info(
      '[PackageManagerService.savePackageReadme] save packageId:%s readme, size: %s',
      pkg.packageId,
      readme.length,
    );
  }

  private async _removePackageVersionAndDist(pkgVersion: PackageVersion) {
    // remove nfs dists
    await Promise.all([
      this.distRepository.destroyDist(pkgVersion.abbreviatedDist),
      this.distRepository.destroyDist(pkgVersion.manifestDist),
      this.distRepository.destroyDist(pkgVersion.readmeDist),
      this.distRepository.destroyDist(pkgVersion.tarDist),
    ]);
    // remove from repository
    await this.packageRepository.removePackageVersion(pkgVersion);
  }

  public async unpublishPackage(pkg: Package) {
    const pkgVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    // already unpublished
    if (pkgVersions.length === 0) {
      this.logger.info(`[packageManagerService.unpublishPackage:skip] ${pkg.packageId} already unpublished`);
      return;
    }
    for (const pkgVersion of pkgVersions) {
      await this._removePackageVersionAndDist(pkgVersion);
    }
    // set unpublished dist to package's manifestDist and abbreviatedDist
    const unpublishedInfo = {
      _id: pkg.fullname,
      name: pkg.fullname,
      time: {
        created: pkg.createdAt,
        modified: pkg.updatedAt,
        unpublished: new Date(),
      },
      // keep this property exists for forward compatibility
      // https://github.com/cnpm/cnpmjs.org/blob/ad622d55e384743b48e79bb6aec574a7f354ee9f/controllers/sync_module_worker.js#L828
      'dist-tags': {},
    };
    await this._mergeManifestDist(
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      pkg.manifestsDist!,
      undefined,
      unpublishedInfo,
    );
    await this._mergeManifestDist(
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      pkg.abbreviatedsDist!,
      undefined,
      unpublishedInfo,
    );
    this.eventBus.emit(PACKAGE_UNPUBLISHED, pkg.fullname);
  }

  public async removePackageVersion(pkg: Package, pkgVersion: PackageVersion, skipRefreshPackageManifests = false) {
    const currentVersions = await this.packageRepository.listPackageVersionNames(pkg.packageId);
    // only one version, unpublish the package
    if (currentVersions.length === 1 && currentVersions[0] === pkgVersion.version) {
      await this.unpublishPackage(pkg);
      return;
    }
    // remove version & update tags
    await this._removePackageVersionAndDist(pkgVersion);
    const versions = await this.packageRepository.listPackageVersionNames(pkg.packageId);
    if (versions.length > 0) {
      let updateTag: string | undefined;
      // make sure latest tag exists
      const latestTag = await this.packageRepository.findPackageTag(pkg.packageId, 'latest');
      if (latestTag?.version === pkgVersion.version) {
        // change latest version
        // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L62
        const latestVersion = versions.sort(semver.compareLoose).pop();
        if (latestVersion) {
          updateTag = latestTag.tag;
          await this.savePackageTag(pkg, latestTag.tag, latestVersion, true);
        }
      }
      if (skipRefreshPackageManifests !== true) {
        await this.refreshPackageChangeVersionsToDists(pkg, undefined, [pkgVersion.version]);
        this.eventBus.emit(PACKAGE_VERSION_REMOVED, pkg.fullname, pkgVersion.version, updateTag);
      }
      return;
    }
  }

  public async savePackageTag(pkg: Package, tag: string, version: string, skipEvent = false) {
    let tagEntity = await this.packageRepository.findPackageTag(pkg.packageId, tag);
    if (!tagEntity) {
      tagEntity = PackageTag.create({
        packageId: pkg.packageId,
        tag,
        version,
      });
      await this.packageRepository.savePackageTag(tagEntity);
      await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
      if (!skipEvent) {
        this.eventBus.emit(PACKAGE_TAG_ADDED, pkg.fullname, tagEntity.tag);
      }
      return true;
    }
    if (tagEntity.version === version) {
      // nothing change
      return false;
    }
    tagEntity.version = version;
    await this.packageRepository.savePackageTag(tagEntity);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
    if (!skipEvent) {
      this.eventBus.emit(PACKAGE_TAG_CHANGED, pkg.fullname, tagEntity.tag);
    }
    return true;
  }

  public async removePackageTag(pkg: Package, tag: string) {
    const tagEntity = await this.packageRepository.findPackageTag(pkg.packageId, tag);
    if (!tagEntity) return false;
    await this.packageRepository.removePackageTag(tagEntity);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
    this.eventBus.emit(PACKAGE_TAG_REMOVED, pkg.fullname, tagEntity.tag);
    return true;
  }

  public async refreshPackageChangeVersionsToDists(pkg: Package, updateVersions?: string[], removeVersions?: string[]) {
    if (this.config.cnpmcore.experimental.enableJSONBuilder) {
      return await this._refreshPackageChangeVersionsToDistsWithBuilder(pkg, updateVersions, removeVersions);
    }
    if (!pkg.manifestsDist?.distId || !pkg.abbreviatedsDist?.distId) {
      // no dists, refresh all again, the first time sync package will not have dists
      return await this._refreshPackageManifestsToDists(pkg);
    }
    const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist);
    const abbreviatedManifests = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageManifestType>(
      pkg.abbreviatedsDist,
    );
    if (!fullManifests?.versions || !abbreviatedManifests?.versions) {
      // is unpublished, refresh all again
      return await this._refreshPackageManifestsToDists(pkg);
    }

    if (updateVersions) {
      for (const version of updateVersions) {
        const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
        if (packageVersion) {
          const manifest = await this.distRepository.readDistBytesToJSON<PackageJSONType>(packageVersion.manifestDist);
          if (!manifest) continue;
          if ('readme' in manifest) {
            delete manifest.readme;
          }
          fullManifests.versions[packageVersion.version] = manifest;
          fullManifests.time[packageVersion.version] = packageVersion.publishTime;

          const abbreviatedManifest = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageJSONType>(
            packageVersion.abbreviatedDist,
          );
          if (abbreviatedManifest) {
            abbreviatedManifests.versions[packageVersion.version] = abbreviatedManifest;
            // abbreviatedManifests.time is guaranteed to exist since it's initialized in _listPackageAbbreviatedManifests
            if (abbreviatedManifests.time) {
              abbreviatedManifests.time[packageVersion.version] = packageVersion.publishTime;
            }
          }
        }
      }
    }
    if (removeVersions) {
      for (const version of removeVersions) {
        delete fullManifests.versions[version];
        delete fullManifests.time[version];
        delete abbreviatedManifests.versions[version];
        delete abbreviatedManifests.time?.[version];
      }
    }

    // update dist-tags
    await this._setPackageDistTagsAndLatestInfos(pkg, fullManifests, abbreviatedManifests);
    // store to nfs dist
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
  }

  private async _refreshPackageChangeVersionsToDistsWithBuilder(
    pkg: Package,
    updateVersions?: string[],
    removeVersions?: string[],
  ) {
    if (!pkg.manifestsDist?.distId || !pkg.abbreviatedsDist?.distId) {
      // no dists, refresh all again, the first time sync package will not have dists
      return await this._refreshPackageManifestsToDists(pkg);
    }
    const fullManifestsBuffer = await this.distRepository.readDistBytesToBuffer(pkg.manifestsDist);
    const abbreviatedManifestsBuffer = await this.distRepository.readDistBytesToBuffer(pkg.abbreviatedsDist);
    if (!fullManifestsBuffer || !abbreviatedManifestsBuffer) {
      // is unpublished, refresh all again
      return await this._refreshPackageManifestsToDists(pkg);
    }
    const fullManifestsBuilder = new JSONBuilder(fullManifestsBuffer);
    const abbreviatedManifestsBuilder = new JSONBuilder(abbreviatedManifestsBuffer);
    if (!fullManifestsBuilder.hasIn(['versions']) || !abbreviatedManifestsBuilder.hasIn(['versions'])) {
      // is unpublished, refresh all again
      return await this._refreshPackageManifestsToDists(pkg);
    }

    if (updateVersions) {
      for (const version of updateVersions) {
        const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
        if (packageVersion) {
          const manifest = await this.distRepository.readDistBytesToJSON<PackageJSONType>(packageVersion.manifestDist);
          if (!manifest) continue;
          if ('readme' in manifest) {
            delete manifest.readme;
          }
          fullManifestsBuilder.setIn(['versions', packageVersion.version], manifest);
          fullManifestsBuilder.setIn(['time', packageVersion.version], packageVersion.publishTime);

          const abbreviatedManifest = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageJSONType>(
            packageVersion.abbreviatedDist,
          );
          if (abbreviatedManifest) {
            abbreviatedManifestsBuilder.setIn(['versions', packageVersion.version], abbreviatedManifest);
            // abbreviatedManifests.time is guaranteed to exist since it's initialized in _listPackageAbbreviatedManifests
            abbreviatedManifestsBuilder.setIn(['time', packageVersion.version], packageVersion.publishTime);
          }
        }
      }
    }
    if (removeVersions) {
      for (const version of removeVersions) {
        fullManifestsBuilder.deleteIn(['versions', version]);
        fullManifestsBuilder.deleteIn(['time', version]);
        abbreviatedManifestsBuilder.deleteIn(['versions', version]);
        abbreviatedManifestsBuilder.deleteIn(['time', version]);
      }
    }

    // update dist-tags
    await this._setPackageDistTagsAndLatestInfosWithBuilder(pkg, fullManifestsBuilder, abbreviatedManifestsBuilder);
    // store to nfs dist
    await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, abbreviatedManifestsBuilder);
  }

  async getSourceRegistry(pkg: Package): Promise<Registry | null> {
    let registry: Registry | null;
    if (pkg.registryId) {
      registry = await this.registryManagerService.findByRegistryId(pkg.registryId);
    } else {
      registry = await this.registryManagerService.ensureDefaultRegistry();
    }
    return registry;
  }

  async distTags(pkg: Package): Promise<PackageManifestType['dist-tags']> {
    const entities = await this.packageRepository.listPackageTags(pkg.packageId);
    const distTags: PackageManifestType['dist-tags'] = {};
    for (const entity of entities) {
      distTags[entity.tag] = entity.version;
    }
    return distTags;
  }

  // refresh package full manifests and abbreviated manifests to NFS
  private async _refreshPackageManifestsToDists(pkg: Package) {
    const [fullManifests, abbreviatedManifests] = await Promise.all([
      this._listPackageFullManifests(pkg),
      this._listPackageAbbreviatedManifests(pkg),
    ]);
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
  }

  // only refresh root attributes only, e.g.: dist-tags, maintainers
  private async _refreshPackageManifestRootAttributeOnlyToDists(
    pkg: Package,
    refreshAttr: 'dist-tags' | 'maintainers',
  ) {
    if (this.config.cnpmcore.experimental.enableJSONBuilder) {
      return await this._refreshPackageManifestRootAttributeOnlyToDistsWithBuilder(pkg, refreshAttr);
    }

    if (refreshAttr === 'maintainers') {
      const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist!);
      if (fullManifests) {
        const maintainers = await this.maintainers(pkg);
        fullManifests.maintainers = maintainers;
        await this._updatePackageManifestsToDists(pkg, fullManifests, null);
      }
    } else if (refreshAttr === 'dist-tags') {
      const fullManifests = await this.distRepository.readDistBytesToJSON<PackageManifestType>(pkg.manifestsDist!);
      if (fullManifests) {
        const abbreviatedManifests = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageManifestType>(
          pkg.abbreviatedsDist!,
        );
        if (abbreviatedManifests) {
          await this._setPackageDistTagsAndLatestInfos(pkg, fullManifests, abbreviatedManifests);
        }
        await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
      }
    }
  }

  private async _refreshPackageManifestRootAttributeOnlyToDistsWithBuilder(
    pkg: Package,
    refreshAttr: 'dist-tags' | 'maintainers',
  ) {
    if (refreshAttr === 'maintainers') {
      const fullManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.manifestsDist!);
      if (fullManifestsBuilder) {
        const maintainers = await this.maintainers(pkg);
        fullManifestsBuilder.setIn(['maintainers'], maintainers);
        await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, undefined);
      }
    } else if (refreshAttr === 'dist-tags') {
      const fullManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.manifestsDist!);
      if (fullManifestsBuilder) {
        const abbreviatedManifestsBuilder = await this.distRepository.readDistBytesToJSONBuilder(pkg.abbreviatedsDist!);
        if (abbreviatedManifestsBuilder) {
          await this._setPackageDistTagsAndLatestInfosWithBuilder(
            pkg,
            fullManifestsBuilder,
            abbreviatedManifestsBuilder,
          );
        }
        await this._updatePackageManifestsToDistsWithBuilder(pkg, fullManifestsBuilder, abbreviatedManifestsBuilder);
      }
    }
  }

  private _mergeLatestManifestFields(fullManifests: PackageManifestType, latestManifest: PackageJSONType | undefined) {
    if (!latestManifest) return;
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const fieldsFromLatestManifest = [
      'author',
      'bugs',
      'contributors',
      'description',
      'homepage',
      'keywords',
      'license',
      'readmeFilename',
      'repository',
    ] as const;
    // the latest version metas
    for (const field of fieldsFromLatestManifest) {
      if (latestManifest[field]) {
        Reflect.set(fullManifests, field, latestManifest[field]);
      }
    }
  }

  private _mergeLatestManifestFieldsWithBuilder(
    fullManifestsBuilder: JSONBuilder,
    latestManifest: PackageJSONType | undefined,
  ) {
    if (!latestManifest) return;
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const fieldsFromLatestManifest = [
      'author',
      'bugs',
      'contributors',
      'description',
      'homepage',
      'keywords',
      'license',
      'readmeFilename',
      'repository',
    ] as const;
    // the latest version metas
    for (const field of fieldsFromLatestManifest) {
      if (latestManifest[field]) {
        fullManifestsBuilder.setIn([field], latestManifest[field]);
      }
    }
  }

  private async _setPackageDistTagsAndLatestInfos(
    pkg: Package,
    fullManifests: PackageManifestType,
    abbreviatedManifests: AbbreviatedPackageManifestType,
  ) {
    const distTags = await this.distTags(pkg);
    if (distTags.latest) {
      const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, distTags.latest);
      if (packageVersion) {
        fullManifests.readme = await this.distRepository.readDistBytesToString(packageVersion.readmeDist);
        const latestManifest = await this.distRepository.readDistBytesToJSON<PackageJSONType>(
          packageVersion.manifestDist,
        );
        this._mergeLatestManifestFields(fullManifests, latestManifest);
      }
    }
    fullManifests['dist-tags'] = distTags;
    abbreviatedManifests['dist-tags'] = distTags;
  }

  private async _setPackageDistTagsAndLatestInfosWithBuilder(
    pkg: Package,
    fullManifestsBuilder: JSONBuilder,
    abbreviatedManifestsBuilder: JSONBuilder,
  ) {
    const distTags = await this.distTags(pkg);
    if (distTags.latest) {
      const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, distTags.latest);
      if (packageVersion) {
        const readme = await this.distRepository.readDistBytesToString(packageVersion.readmeDist);
        fullManifestsBuilder.setIn(['readme'], readme);
        const latestManifest = await this.distRepository.readDistBytesToJSON<PackageJSONType>(
          packageVersion.manifestDist,
        );
        this._mergeLatestManifestFieldsWithBuilder(fullManifestsBuilder, latestManifest);
      }
    }

    fullManifestsBuilder.setIn(['dist-tags'], distTags);
    abbreviatedManifestsBuilder.setIn(['dist-tags'], distTags);
  }

  private async _mergeManifestDist(manifestDist: Dist, mergeData?: unknown, replaceData?: unknown) {
    let manifest = await this.distRepository.readDistBytesToJSON<PackageManifestType>(manifestDist);
    if (mergeData && manifest) {
      Object.assign(manifest, mergeData);
    }
    if (replaceData) {
      manifest = replaceData as PackageManifestType;
    }
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    const manifestIntegrity = await calculateIntegrity(manifestBytes);
    manifestDist.size = manifestBytes.length;
    manifestDist.shasum = manifestIntegrity.shasum;
    manifestDist.integrity = manifestIntegrity.integrity;
    await this.distRepository.saveDist(manifestDist, manifestBytes);
  }

  private async _updatePackageManifestsToDists(
    pkg: Package,
    fullManifests: PackageManifestType | undefined | null,
    abbreviatedManifests: AbbreviatedPackageManifestType | undefined | null,
  ): Promise<void> {
    const modified = new Date();
    if (fullManifests) {
      fullManifests.time.modified = modified;
      // same to dist
      const fullManifestsDistBytes = Buffer.from(JSON.stringify(fullManifests));
      const fullManifestsDistIntegrity = await calculateIntegrity(fullManifestsDistBytes);
      if (pkg.manifestsDist?.distId) {
        pkg.manifestsDist.size = fullManifestsDistBytes.length;
        pkg.manifestsDist.shasum = fullManifestsDistIntegrity.shasum;
        pkg.manifestsDist.integrity = fullManifestsDistIntegrity.integrity;
      } else {
        pkg.manifestsDist = pkg.createFullManifests({
          size: fullManifestsDistBytes.length,
          shasum: fullManifestsDistIntegrity.shasum,
          integrity: fullManifestsDistIntegrity.integrity,
        });
      }
      await this.distRepository.saveDist(pkg.manifestsDist, fullManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, true);
    }
    if (abbreviatedManifests) {
      abbreviatedManifests.modified = modified;
      const abbreviatedManifestsDistBytes = Buffer.from(JSON.stringify(abbreviatedManifests));
      const abbreviatedManifestsDistIntegrity = await calculateIntegrity(abbreviatedManifestsDistBytes);
      if (pkg.abbreviatedsDist?.distId) {
        pkg.abbreviatedsDist.size = abbreviatedManifestsDistBytes.length;
        pkg.abbreviatedsDist.shasum = abbreviatedManifestsDistIntegrity.shasum;
        pkg.abbreviatedsDist.integrity = abbreviatedManifestsDistIntegrity.integrity;
      } else {
        pkg.abbreviatedsDist = pkg.createAbbreviatedManifests({
          size: abbreviatedManifestsDistBytes.length,
          shasum: abbreviatedManifestsDistIntegrity.shasum,
          integrity: abbreviatedManifestsDistIntegrity.integrity,
        });
      }
      await this.distRepository.saveDist(pkg.abbreviatedsDist, abbreviatedManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, false);
    }
  }

  private async _updatePackageManifestsToDistsWithBuilder(
    pkg: Package,
    fullManifestsBuilder: JSONBuilder | undefined,
    abbreviatedManifestsBuilder: JSONBuilder | undefined,
  ): Promise<void> {
    const modified = new Date();
    if (fullManifestsBuilder) {
      fullManifestsBuilder.setIn(['time', 'modified'], modified);
      // same to dist
      const fullManifestsDistBytes = fullManifestsBuilder.build();
      const fullManifestsDistIntegrity = await calculateIntegrity(fullManifestsDistBytes);
      if (pkg.manifestsDist?.distId) {
        pkg.manifestsDist.size = fullManifestsDistBytes.length;
        pkg.manifestsDist.shasum = fullManifestsDistIntegrity.shasum;
        pkg.manifestsDist.integrity = fullManifestsDistIntegrity.integrity;
      } else {
        pkg.manifestsDist = pkg.createFullManifests({
          size: fullManifestsDistBytes.length,
          shasum: fullManifestsDistIntegrity.shasum,
          integrity: fullManifestsDistIntegrity.integrity,
        });
      }
      await this.distRepository.saveDist(pkg.manifestsDist, fullManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, true);
    }
    if (abbreviatedManifestsBuilder) {
      abbreviatedManifestsBuilder.setIn(['modified'], modified);
      const abbreviatedManifestsDistBytes = abbreviatedManifestsBuilder.build();
      const abbreviatedManifestsDistIntegrity = await calculateIntegrity(abbreviatedManifestsDistBytes);
      if (pkg.abbreviatedsDist?.distId) {
        pkg.abbreviatedsDist.size = abbreviatedManifestsDistBytes.length;
        pkg.abbreviatedsDist.shasum = abbreviatedManifestsDistIntegrity.shasum;
        pkg.abbreviatedsDist.integrity = abbreviatedManifestsDistIntegrity.integrity;
      } else {
        pkg.abbreviatedsDist = pkg.createAbbreviatedManifests({
          size: abbreviatedManifestsDistBytes.length,
          shasum: abbreviatedManifestsDistIntegrity.shasum,
          integrity: abbreviatedManifestsDistIntegrity.integrity,
        });
      }
      await this.distRepository.saveDist(pkg.abbreviatedsDist, abbreviatedManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, false);
    }
  }

  private async _listPackageFullOrAbbreviatedManifests<T extends PackageManifestType | AbbreviatedPackageManifestType>(
    scope: string,
    name: string,
    isFullManifests: boolean,
    isSync: boolean,
  ) {
    let etag = '';
    let blockReason = '';
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      return { etag, data: null, blockReason };
    }

    const registry = await this.getSourceRegistry(pkg);

    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      blockReason = block.reason;
    }

    let bugVersion: BugVersion | undefined;
    // sync mode response no bug version fixed
    if (!isSync) {
      bugVersion = await this.bugVersionService.getBugVersion();
    }
    const fullname = getFullname(scope, name);

    let dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    // read from dist
    if (dist?.distId) {
      etag = `"${dist.shasum}"`;
      const data = (await this.distRepository.readDistBytesToJSON(dist)) as T;
      let needCalculateIntegrity = false;
      if (bugVersion) {
        const fixedVersions = await this.bugVersionService.fixPackageBugVersions(bugVersion, fullname, data);
        if (fixedVersions.length > 0) {
          // calculate integrity after fix bug version
          needCalculateIntegrity = true;
        }
      }
      // set _source_registry_name in full manifestDist
      if (registry?.name && data._source_registry_name !== registry.name) {
        data._source_registry_name = registry.name;
        // calculate integrity after set _source_registry_name
        needCalculateIntegrity = true;
      }

      if (needCalculateIntegrity) {
        const distBytes = Buffer.from(JSON.stringify(data));
        const distIntegrity = await calculateIntegrity(distBytes);
        etag = `"${distIntegrity.shasum}"`;
      }
      return { etag, data, blockReason };
    }

    // read from database then update to dist, the next time will read from dist
    const fullManifests = isFullManifests ? await this._listPackageFullManifests(pkg) : null;
    const abbreviatedManifests = isFullManifests ? null : await this._listPackageAbbreviatedManifests(pkg);
    if (!fullManifests && !abbreviatedManifests) {
      // not exists
      return { etag, data: null, blockReason };
    }

    // update to dist, the next time will read from dist
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    const manifests = (fullManifests || abbreviatedManifests) as T;
    if (bugVersion) {
      const fixedVersions = await this.bugVersionService.fixPackageBugVersions(
        bugVersion,
        fullname,
        manifests,
      );
      if (fixedVersions.length > 0) {
        // calculate integrity after fix bug version
        const distBytes = Buffer.from(JSON.stringify(manifests));
        const distIntegrity = await calculateIntegrity(distBytes);
        etag = `"${distIntegrity.shasum}"`;
      }
    } else {
      dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
      etag = `"${dist!.shasum}"`;
    }
    return { etag, data: manifests, blockReason };
  }

  private async _listPackageFullOrAbbreviatedManifestsBuffer(scope: string, name: string, isFullManifests: boolean) {
    let etag = '';
    let blockReason = '';
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      return { etag, data: null, blockReason };
    }

    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      blockReason = block.reason;
    }

    // let bugVersion: BugVersion | undefined;
    // // sync mode response no bug version fixed
    // if (!isSync) {
    //   bugVersion = await this.bugVersionService.getBugVersion();
    // }
    // const fullname = getFullname(scope, name);

    let dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    // read from dist
    if (dist?.distId) {
      etag = `"${dist.shasum}"`;
      let builder = (await this.distRepository.readDistBytesToJSONBuilder(dist)) as JSONBuilder;
      let needCalculateIntegrity = false;
      // set _source_registry_name in full manifestDist
      const registry = await this.getSourceRegistry(pkg);
      if (registry?.name && builder.getIn<string>(['_source_registry_name']) !== registry.name) {
        builder.setIn(['_source_registry_name'], registry.name);
        // calculate integrity after set _source_registry_name
        needCalculateIntegrity = true;
      }
      // TODO: support bug version with builder
      // if (bugVersion) {
      //   const fixedVersions = await this.bugVersionService.fixPackageBugVersions(bugVersion, fullname, data.versions);
      //   if (fixedVersions.length > 0) {
      //     // calculate integrity after fix bug version
      //     needCalculateIntegrity = true;
      //   }
      // }
      const data = builder.build();
      if (needCalculateIntegrity) {
        const distIntegrity = await calculateIntegrity(data);
        etag = `"${distIntegrity.shasum}"`;
      }
      return { etag, data, blockReason };
    }

    // read from database then update to dist, the next time will read from dist
    const fullManifests = isFullManifests ? await this._listPackageFullManifests(pkg) : null;
    const abbreviatedManifests = isFullManifests ? null : await this._listPackageAbbreviatedManifests(pkg);
    if (!fullManifests && !abbreviatedManifests) {
      // not exists
      return { etag, data: null, blockReason };
    }

    // update to dist, the next time will read from dist
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    const manifests = fullManifests || abbreviatedManifests;
    dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    etag = `"${dist!.shasum}"`;
    // TODO: support bug version with builder
    // if (bugVersion) {
    //   const fixedVersions = await this.bugVersionService.fixPackageBugVersions(
    //     bugVersion,
    //     fullname,
    //     manifests as any,
    //   );
    //   if (fixedVersions.length > 0) {
    //     // calculate integrity after fix bug version
    //     const distBytes = Buffer.from(JSON.stringify(manifests));
    //     const distIntegrity = await calculateIntegrity(distBytes);
    //     etag = `"${distIntegrity.shasum}"`;
    //   }
    // }
    return { etag, data: Buffer.from(JSON.stringify(manifests)), blockReason };
  }

  async maintainers(pkg: Package): Promise<AuthorType[]> {
    const users = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    return users.map(({ displayName, email }) => ({
      name: displayName,
      email,
    }));
  }

  private async _listPackageFullManifests(pkg: Package): Promise<PackageManifestType | null> {
    // read all versions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    const distTags = await this.distTags(pkg);
    const maintainers = await this.maintainers(pkg);
    const registry = await this.getSourceRegistry(pkg);
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const data: PackageManifestType = {
      _id: `${pkg.fullname}`,
      _rev: `${pkg.id}-${pkg.packageId}`,
      'dist-tags': distTags,
      // the package name
      name: pkg.fullname,
      // an object mapping versions to the time published, along with created and modified timestamps
      time: {
        // '1.0.0': '2012-09-18T14:46:08.346Z',
        created: pkg.createdAt,
        modified: pkg.updatedAt,
      },
      // a mapping of semver-compliant version numbers to version data
      versions: {},
      // The following fields are hoisted to the top-level of the package json from the latest version published:
      // human object
      author: undefined,
      bugs: undefined,
      description: pkg.description,
      homepage: undefined,
      keywords: undefined,
      // the SPDX identifier of the package's license
      license: undefined,
      // array of human objects for people with permission to publish this package; not authoritative but informational
      maintainers,
      // contributors: array of human objects
      // the first 64K of the README data for the most-recently published version of the package
      readme: '',
      // The name of the file from which the readme data was taken
      readmeFilename: undefined,
      // as given in package.json, for the latest version
      repository: undefined,
      // users: an object whose keys are the npm user names of people who have starred this package
      _source_registry_name: registry?.name,
    };

    let latestTagVersion = '';
    if (distTags.latest) {
      latestTagVersion = distTags.latest;
    }

    let latestManifest: PackageJSONType | undefined;
    let latestPackageVersion = packageVersions[0];
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    for (const packageVersion of packageVersions) {
      const manifest = await this.distRepository.readDistBytesToJSON<PackageJSONType>(packageVersion.manifestDist);
      if (!manifest) continue;
      if ('readme' in manifest) {
        delete manifest.readme;
      }
      if (latestTagVersion && packageVersion.version === latestTagVersion) {
        latestManifest = manifest;
        latestPackageVersion = packageVersion;
      }
      data.versions[packageVersion.version] = manifest;
      data.time[packageVersion.version] = packageVersion.publishTime;
    }
    // the latest version readme
    data.readme = await this.distRepository.readDistBytesToString(latestPackageVersion.readmeDist);
    if (!latestManifest) {
      latestManifest = data.versions[latestPackageVersion.version];
    }
    this._mergeLatestManifestFields(data, latestManifest as PackageJSONType);
    return data;
  }

  private async _listPackageAbbreviatedManifests(pkg: Package): Promise<AbbreviatedPackageManifestType | null> {
    // read all versions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    const distTags = await this.distTags(pkg);
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    // tiny-tarball is a small package with only one version and no dependencies.
    const data: AbbreviatedPackageManifestType = {
      'dist-tags': distTags,
      modified: pkg.updatedAt,
      name: pkg.fullname,
      versions: {},
      time: {
        created: pkg.createdAt,
        modified: pkg.updatedAt,
      },
    };

    for (const packageVersion of packageVersions) {
      const manifest = await this.distRepository.readDistBytesToJSON<AbbreviatedPackageJSONType>(
        packageVersion.abbreviatedDist,
      );
      if (manifest) {
        data.versions[packageVersion.version] = manifest;
        // data.time is guaranteed to exist since we initialize it above
        if (data.time) {
          data.time[packageVersion.version] = packageVersion.publishTime;
        }
      }
    }
    return data;
  }

  private async _checkPackageDepsVersion(pkgJSON: PackageJSONType) {
    // 只校验 dependencies
    // devDependencies、optionalDependencies、peerDependencies 不会影响依赖安装 不在这里进行校验
    const { dependencies } = pkgJSON;
    await pMap(
      Object.entries(dependencies || {}),
      async ([fullname, spec]) => {
        try {
          const specResult = npa(`${fullname}@${spec}`);
          // 对于 git、alias、file 等类型的依赖，不进行版本校验
          if (!['range', 'tag', 'version'].includes(specResult.type)) {
            return;
          }
          const pkgVersion = await this.packageVersionService.getVersion(npa(`${fullname}@${spec}`));
          assert.ok(pkgVersion);
        } catch {
          throw new BadRequestError(`deps ${fullname}@${spec} not found`);
        }
      },
      {
        concurrency: 12,
      },
    );
  }
}
