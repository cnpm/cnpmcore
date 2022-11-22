import { stat } from 'fs/promises';
import {
  AccessLevel,
  ContextProto,
  EventBus,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';
import { RequireAtLeastOne } from 'type-fest';
import semver from 'semver';
import { calculateIntegrity, detectInstallScript, formatTarball, getFullname, getScopeAndName } from '../../common/PackageUtil';
import { AbstractService } from '../../common/AbstractService';
import { BugVersionStore } from '../../common/adapter/BugVersionStore';
import { BUG_VERSIONS, LATEST_TAG } from '../../common/constants';
import { PackageRepository } from '../../repository/PackageRepository';
import { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { DistRepository } from '../../repository/DistRepository';
import { Package } from '../entity/Package';
import { PackageVersion } from '../entity/PackageVersion';
import { PackageVersionBlock } from '../entity/PackageVersionBlock';
import { PackageTag } from '../entity/PackageTag';
import { User } from '../entity/User';
import { Dist } from '../entity/Dist';
import {
  PACKAGE_UNPUBLISHED,
  PACKAGE_BLOCKED,
  PACKAGE_UNBLOCKED,
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
  PACKAGE_META_CHANGED,
} from '../event';
import { BugVersionService } from './BugVersionService';
import { BugVersion } from '../entity/BugVersion';

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  scope: string;
  // name don't include scope
  name: string;
  version: string;
  description: string;
  packageJson: any;
  registryId?: string;
  readme: string;
  // require content or localFile field
  dist: RequireAtLeastOne<{
    // package controller will use content field
    content?: Uint8Array;
    // sync worker will use localFile field
    localFile?: string;
  }, 'content' | 'localFile'>;
  tag?: string;
  isPrivate: boolean;
  // only use on sync package
  publishTime?: Date;
  // only use on sync package for speed up https://github.com/cnpm/cnpmcore/issues/28
  skipRefreshPackageManifests?: boolean;
}

const TOTAL = '@@TOTAL@@';
const SCOPE_TOTAL_PREFIX = '@@SCOPE@@:';
const DESCRIPTION_LIMIT = 1024 * 10;

@ContextProto({
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
  private readonly bugVersionStore: BugVersionStore;
  @Inject()
  private readonly distRepository: DistRepository;

  private static downloadCounters = {};

  // support user publish private package and sync worker publish public package
  async publish(cmd: PublishPackageCmd, publisher: User) {
    let pkg = await this.packageRepository.findPackage(cmd.scope, cmd.name);
    if (!pkg) {
      pkg = Package.create({
        scope: cmd.scope,
        name: cmd.name,
        isPrivate: cmd.isPrivate,
        description: cmd.description,
        registryId: cmd.registryId,
      });
    } else {
      // update description
      // will read database twice to update description by model to entity and entity to model
      if (pkg.description !== cmd.description) {
        pkg.description = cmd.description;
      }

      if (!pkg.registryId && cmd.registryId) {
        pkg.registryId = cmd.registryId;
      }
    }

    // 防止 description 长度超过 db 限制
    if (pkg.description?.length > DESCRIPTION_LIMIT) {
      pkg.description = pkg.description.substring(0, DESCRIPTION_LIMIT);
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

    // add _cnpmcore_publish_time field to cmd.packageJson
    if (!cmd.packageJson._cnpmcore_publish_time) {
      cmd.packageJson._cnpmcore_publish_time = new Date();
    }

    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#abbreviated-version-object
    const hasInstallScript = detectInstallScript(cmd.packageJson) ? true : undefined;
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

    const abbreviated = JSON.stringify({
      name: cmd.packageJson.name,
      version: cmd.packageJson.version,
      deprecated: cmd.packageJson.deprecated,
      dependencies: cmd.packageJson.dependencies,
      optionalDependencies: cmd.packageJson.optionalDependencies,
      devDependencies: cmd.packageJson.devDependencies,
      bundleDependencies: cmd.packageJson.bundleDependencies,
      peerDependencies: cmd.packageJson.peerDependencies,
      peerDependenciesMeta: cmd.packageJson.peerDependenciesMeta,
      bin: cmd.packageJson.bin,
      os: cmd.packageJson.os,
      cpu: cmd.packageJson.cpu,
      libc: cmd.packageJson.libc,
      workspaces: cmd.packageJson.workspaces,
      directories: cmd.packageJson.directories,
      dist: cmd.packageJson.dist,
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

    pkgVersion = PackageVersion.create({
      packageId: pkg.packageId,
      version: cmd.version,
      publishTime: cmd.publishTime || new Date(),
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
    await this.packageRepository.createPackageVersion(pkgVersion);
    if (cmd.skipRefreshPackageManifests !== true) {
      await this.refreshPackageChangeVersionsToDists(pkg, [ pkgVersion.version ]);
    }
    if (cmd.tag) {
      await this.savePackageTag(pkg, cmd.tag, cmd.version, true);
    }
    this.eventBus.emit(PACKAGE_VERSION_ADDED, pkg.fullname, pkgVersion.version, cmd.tag);
    return pkgVersion;
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
      const fullManifests = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist);
      if (fullManifests) {
        fullManifests.block = reason;
      }
      const abbreviatedManifests = await this.distRepository.readDistBytesToJSON(pkg.abbreviatedsDist);
      if (abbreviatedManifests) {
        abbreviatedManifests.block = reason;
      }
      await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
      this.eventBus.emit(PACKAGE_BLOCKED, pkg.fullname);
      this.logger.info('[packageManagerService.blockPackage:success] packageId: %s, reason: %j',
        pkg.packageId, reason);
    }
    return block;
  }

  async unblockPackage(pkg: Package) {
    const block = await this.packageVersionBlockRepository.findPackageVersionBlock(pkg.packageId, '*');
    if (block) {
      await this.packageVersionBlockRepository.removePackageVersionBlock(block.packageVersionBlockId);
    }
    if (pkg.manifestsDist && pkg.abbreviatedsDist) {
      const fullManifests = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist);
      if (fullManifests) {
        fullManifests.block = undefined;
      }
      const abbreviatedManifests = await this.distRepository.readDistBytesToJSON(pkg.abbreviatedsDist);
      if (abbreviatedManifests) {
        abbreviatedManifests.block = undefined;
      }
      await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
      this.eventBus.emit(PACKAGE_UNBLOCKED, pkg.fullname);
      this.logger.info('[packageManagerService.unblockPackage:success] packageId: %s',
        pkg.packageId);
    }
  }

  async replacePackageMaintainers(pkg: Package, maintainers: User[]) {
    await this.packageRepository.replacePackageMaintainers(pkg.packageId, maintainers.map(m => m.userId));
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
    this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.fullname, maintainers);
  }

  async savePackageMaintainers(pkg: Package, maintainers: User[]) {
    let hasNewRecord = false;
    for (const maintainer of maintainers) {
      const newRecord = await this.packageRepository.savePackageMaintainer(pkg.packageId, maintainer.userId);
      if (newRecord) {
        hasNewRecord = true;
      }
    }
    if (hasNewRecord) {
      await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
      this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.fullname, maintainers);
    }
  }

  async removePackageMaintainer(pkg: Package, maintainer: User) {
    await this.packageRepository.removePackageMaintainer(pkg.packageId, maintainer.userId);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
    this.eventBus.emit(PACKAGE_MAINTAINER_REMOVED, pkg.fullname, maintainer.name);
  }

  async refreshPackageMaintainersToDists(pkg: Package) {
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
  }

  async refreshPackageDistTagsToDists(pkg: Package) {
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
  }

  async listPackageFullManifests(scope: string, name: string, isSync = false) {
    return await this._listPackageFullOrAbbreviatedManifests(scope, name, true, isSync);
  }

  async listPackageAbbreviatedManifests(scope: string, name: string, isSync = false) {
    return await this._listPackageFullOrAbbreviatedManifests(scope, name, false, isSync);
  }

  async showPackageVersionManifest(scope: string, name: string, versionOrTag: string, isSync = false) {
    let blockReason = '';
    let manifest;
    const pkg = await this.packageRepository.findPackage(scope, name);
    const pkgId = pkg?.packageId;
    if (!pkg) return { manifest: null, blockReason, pkgId };

    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      blockReason = block.reason;
      return {
        blockReason,
        manifest,
        pkgId,
      };
    }
    let version = versionOrTag;
    if (!semver.valid(versionOrTag)) {
      // invalid version, versionOrTag is a tag
      const packageTag = await this.packageRepository.findPackageTag(pkg.packageId, versionOrTag);
      if (packageTag) {
        version = packageTag.version;
      }
    }
    const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
    if (!packageVersion) return { manifest: null, blockReason, pkgId };
    manifest = await this.distRepository.findPackageVersionManifest(packageVersion.packageId, version);
    let bugVersion: BugVersion | undefined;
    // sync mode response no bug version fixed
    if (!isSync) {
      bugVersion = await this.getBugVersion();
    }
    if (bugVersion) {
      const fullname = getFullname(scope, name);
      manifest = await this.bugVersionService.fixPackageBugVersion(bugVersion, fullname, manifest);
    }
    return { manifest, blockReason, pkgId };

  }

  async downloadPackageVersionTar(packageVersion: PackageVersion) {
    return await this.distRepository.downloadDist(packageVersion.tarDist);
  }

  public plusPackageVersionCounter(fullname: string, version: string) {
    // set counter + 1, schedule will store them into database
    const counters = PackageManagerService.downloadCounters;
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
    const counters = PackageManagerService.downloadCounters;
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
        const [ scope, name ] = getScopeAndName(fullname);
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

  public async saveDeprecatedVersions(pkg: Package, deprecateds: { version: string; deprecated: string }[]) {
    const updateVersions: string[] = [];
    for (const { version, deprecated } of deprecateds) {
      const pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
      if (!pkgVersion) continue;
      const message = deprecated === '' ? undefined : deprecated;
      await this._mergeManifestDist(pkgVersion.manifestDist, { deprecated: message });
      await this._mergeManifestDist(pkgVersion.abbreviatedDist, { deprecated: message });
      await this.packageRepository.savePackageVersion(pkgVersion);
      updateVersions.push(version);
    }
    await this.refreshPackageChangeVersionsToDists(pkg, updateVersions);
    this.eventBus.emit(PACKAGE_META_CHANGED, pkg.fullname, { deprecateds });
  }

  public async savePackageVersionManifest(pkgVersion: PackageVersion, mergeManifest: object, mergeAbbreviated: object) {
    await this._mergeManifestDist(pkgVersion.manifestDist, mergeManifest);
    await this._mergeManifestDist(pkgVersion.abbreviatedDist, mergeAbbreviated);
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
    await this._mergeManifestDist(pkg.manifestsDist!, undefined, unpublishedInfo);
    await this._mergeManifestDist(pkg.abbreviatedsDist!, undefined, unpublishedInfo);
    this.eventBus.emit(PACKAGE_UNPUBLISHED, pkg.fullname);
  }

  public async removePackageVersion(pkg: Package, pkgVersion: PackageVersion, skipRefreshPackageManifests = false) {
    await this._removePackageVersionAndDist(pkgVersion);
    // all versions removed
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
        await this.refreshPackageChangeVersionsToDists(pkg, undefined, [ pkgVersion.version ]);
        this.eventBus.emit(PACKAGE_VERSION_REMOVED, pkg.fullname, pkgVersion.version, updateTag);
      }
      return;
    }
    // unpublish
    await this.unpublishPackage(pkg);
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
    if (!pkg.manifestsDist?.distId || !pkg.abbreviatedsDist?.distId) {
      return await this._refreshPackageManifestsToDists(pkg);
    }
    const fullManifests = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist);
    const abbreviatedManifests = await this.distRepository.readDistBytesToJSON(pkg.abbreviatedsDist);
    if (!fullManifests.versions || !abbreviatedManifests.versions) {
      // is unpublished, refresh all again
      return await this._refreshPackageManifestsToDists(pkg);
    }

    if (updateVersions) {
      for (const version of updateVersions) {
        const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
        if (packageVersion) {
          const manifest = await this.distRepository.readDistBytesToJSON(packageVersion.manifestDist);
          if (!manifest) continue;
          if ('readme' in manifest) {
            delete manifest.readme;
          }
          fullManifests.versions[packageVersion.version] = manifest;
          fullManifests.time[packageVersion.version] = packageVersion.publishTime;

          const abbreviatedManifest = await this.distRepository.readDistBytesToJSON(packageVersion.abbreviatedDist);
          abbreviatedManifests.versions[packageVersion.version] = abbreviatedManifest;
        }
      }
    }
    if (removeVersions) {
      for (const version of removeVersions) {
        delete fullManifests.versions[version];
        delete fullManifests.time[version];
        delete abbreviatedManifests.versions[version];
      }
    }

    // update dist-tags
    await this._setPackageDistTagsAndLatestInfos(pkg, fullManifests, abbreviatedManifests);
    // store to nfs dist
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
  }

  async getBugVersion(): Promise<BugVersion | undefined> {
    // TODO performance problem, cache bugVersion and update with schedule
    const pkg = await this.packageRepository.findPackage('', BUG_VERSIONS);
    if (!pkg) return;
    const tag = await this.packageRepository.findPackageTag(pkg!.packageId, LATEST_TAG);
    if (!tag) return;
    let bugVersion = this.bugVersionStore.getBugVersion(tag!.version);
    if (!bugVersion) {
      const packageVersionJson = await this.distRepository.findPackageVersionManifest(pkg!.packageId, tag!.version);
      if (!packageVersionJson) return;
      const data = packageVersionJson.config['bug-versions'];
      bugVersion = new BugVersion(data);
      this.bugVersionStore.setBugVersion(bugVersion, tag!.version);
    }
    return bugVersion;
  }

  private async _listPackageDistTags(pkg: Package) {
    const tags = await this.packageRepository.listPackageTags(pkg.packageId);
    const distTags: { [key: string]: string } = {};
    for (const tag of tags) {
      distTags[tag.tag] = tag.version;
    }
    return distTags;
  }

  // refresh package full manifests and abbreviated manifests to NFS
  private async _refreshPackageManifestsToDists(pkg: Package) {
    const [
      fullManifests,
      abbreviatedManifests,
    ] = await Promise.all([
      await this._listPackageFullManifests(pkg),
      await this._listPackageAbbreviatedManifests(pkg),
    ]);
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
  }

  // only refresh root attributes only, e.g.: dist-tags, maintainers
  private async _refreshPackageManifestRootAttributeOnlyToDists(pkg: Package, refreshAttr: 'dist-tags' | 'maintainers') {
    if (refreshAttr === 'maintainers') {
      const fullManifests = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist!);
      const maintainers = await this._listPackageMaintainers(pkg);
      fullManifests.maintainers = maintainers;
      await this._updatePackageManifestsToDists(pkg, fullManifests, null);
    } else if (refreshAttr === 'dist-tags') {
      const fullManifests = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist!);
      const abbreviatedManifests = await this.distRepository.readDistBytesToJSON(pkg.abbreviatedsDist!);
      await this._setPackageDistTagsAndLatestInfos(pkg, fullManifests, abbreviatedManifests);
      await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    }
  }

  private _mergeLatestManifestFields(fullManifests: object, latestManifest: object) {
    if (!latestManifest) return;
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const fieldsFromLatestManifest = [
      'author', 'bugs', 'contributors', 'description', 'homepage', 'keywords', 'license',
      'readmeFilename', 'repository',
    ];
    // the latest version metas
    for (const field of fieldsFromLatestManifest) {
      fullManifests[field] = latestManifest[field];
    }
  }

  private async _setPackageDistTagsAndLatestInfos(pkg: Package, fullManifests: any, abbreviatedManifests: any) {
    const distTags = await this._listPackageDistTags(pkg);
    if (distTags.latest) {
      const packageVersion = await this.packageRepository.findPackageVersion(pkg.packageId, distTags.latest);
      if (packageVersion) {
        fullManifests.readme = await this.distRepository.readDistBytesToString(packageVersion.readmeDist);
        const latestManifest = await this.distRepository.readDistBytesToJSON(packageVersion.manifestDist);
        this._mergeLatestManifestFields(fullManifests, latestManifest);
      }
    }
    fullManifests['dist-tags'] = distTags;
    abbreviatedManifests['dist-tags'] = distTags;
  }

  private async _mergeManifestDist(manifestDist: Dist, mergeData?: any, replaceData?: any) {
    let manifest = await this.distRepository.readDistBytesToJSON(manifestDist);
    if (mergeData) {
      Object.assign(manifest, mergeData);
    }
    if (replaceData) {
      manifest = replaceData;
    }
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    const manifestIntegrity = await calculateIntegrity(manifestBytes);
    manifestDist.size = manifestBytes.length;
    manifestDist.shasum = manifestIntegrity.shasum;
    manifestDist.integrity = manifestIntegrity.integrity;
    await this.distRepository.saveDist(manifestDist, manifestBytes);
  }

  private async _updatePackageManifestsToDists(pkg: Package, fullManifests: any | null, abbreviatedManifests: any | null): Promise<void> {
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

  private async _listPackageFullOrAbbreviatedManifests(scope: string, name: string, isFullManifests: boolean, isSync: boolean) {
    let etag = '';
    let blockReason = '';
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) return { etag, data: null, blockReason };

    const block = await this.packageVersionBlockRepository.findPackageBlock(pkg.packageId);
    if (block) {
      blockReason = block.reason;
    }

    let bugVersion: BugVersion | undefined;
    // sync mode response no bug version fixed
    if (!isSync) {
      bugVersion = await this.getBugVersion();
    }
    const fullname = getFullname(scope, name);

    let dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    // read from dist
    if (dist?.distId) {
      etag = `"${dist.shasum}"`;
      const data = await this.distRepository.readDistBytesToJSON(dist);
      if (bugVersion) {
        await this.bugVersionService.fixPackageBugVersions(bugVersion, fullname, data.versions);
        const distBytes = Buffer.from(JSON.stringify(data));
        const distIntegrity = await calculateIntegrity(distBytes);
        etag = `"${distIntegrity.shasum}"`;
      }
      return { etag, data, blockReason };
    }

    // read from database
    const fullManifests = isFullManifests ? await this._listPackageFullManifests(pkg) : null;
    const abbreviatedManifests = isFullManifests ? null : await this._listPackageAbbreviatedManifests(pkg);
    if (!fullManifests && !abbreviatedManifests) {
      // not exists
      return { etag, data: null, blockReason };
    }
    await this._updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    const manifests = (fullManifests || abbreviatedManifests)!;
    if (bugVersion) {
      await this.bugVersionService.fixPackageBugVersions(bugVersion, fullname, (manifests as any).versions);
      const distBytes = Buffer.from(JSON.stringify(manifests));
      const distIntegrity = await calculateIntegrity(distBytes);
      etag = `"${distIntegrity.shasum}"`;
    } else {
      dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
      etag = `"${dist!.shasum}"`;
    }
    return { etag, data: manifests, blockReason };
  }

  private async _listPackageMaintainers(pkg: Package) {
    const maintainers: { name: string; email: string; }[] = [];
    const users = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    for (const user of users) {
      const name = user.name.startsWith('npm:') ? user.name.replace('npm:', '') : user.name;
      maintainers.push({ name, email: user.email });
    }
    return maintainers;
  }

  private async _listPackageFullManifests(pkg: Package): Promise<object | null> {
    // read all verions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    const distTags = await this._listPackageDistTags(pkg);
    const maintainers = await this._listPackageMaintainers(pkg);
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#full-metadata-format
    const data = {
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
    };

    let lastestTagVersion = '';
    if (distTags.latest) {
      lastestTagVersion = distTags.latest;
    }

    let latestManifest: any;
    let latestPackageVersion = packageVersions[0];
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    for (const packageVersion of packageVersions) {
      const manifest = await this.distRepository.readDistBytesToJSON(packageVersion.manifestDist);
      if (!manifest) continue;
      if ('readme' in manifest) {
        delete manifest.readme;
      }
      if (lastestTagVersion && packageVersion.version === lastestTagVersion) {
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
    this._mergeLatestManifestFields(data, latestManifest);
    return data;
  }

  private async _listPackageAbbreviatedManifests(pkg: Package): Promise<object | null> {
    // read all verions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    const distTags = await this._listPackageDistTags(pkg);
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    // tiny-tarball is a small package with only one version and no dependencies.
    const data = {
      'dist-tags': distTags,
      modified: pkg.updatedAt,
      name: pkg.fullname,
      versions: {},
    };

    for (const packageVersion of packageVersions) {
      const manifest = await this.distRepository.readDistBytesToJSON(packageVersion.abbreviatedDist);
      data.versions[packageVersion.version] = manifest;
    }
    return data;
  }
}
