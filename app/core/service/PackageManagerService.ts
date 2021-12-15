import { stat } from 'fs/promises';
import { Readable } from 'stream';
import {
  AccessLevel,
  ContextProto,
  EventBus,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';
import { RequireAtLeastOne } from 'type-fest';
import fresh from 'fresh';
import semver from 'semver';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { calculateIntegrity, formatTarball } from '../../common/PackageUtil';
import { PackageRepository } from '../../repository/PackageRepository';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { Package } from '../entity/Package';
import { PackageVersion } from '../entity/PackageVersion';
import { PackageTag } from '../entity/PackageTag';
import { User } from '../entity/User';
import { Dist } from '../entity/Dist';
import {
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
} from '../event';
import { AbstractService } from './AbstractService';

export interface PublishPackageCmd {
  // maintainer: Maintainer;
  scope: string;
  // name don't include scope
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
  }, 'content' | 'localFile'>;
  tag?: string;
  isPrivate: boolean;
  // only use on sync package
  publishTime?: Date;
  // only use on sync package for speed up https://github.com/cnpm/cnpmcore/issues/28
  skipRefreshPackageManifests?: boolean;
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageManagerService extends AbstractService {
  @Inject()
  private readonly eventBus: EventBus;
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

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
      });
    } else {
      // update description
      // will read database twice to update description by model to entity and entity to model
      if (pkg.description !== cmd.description) {
        pkg.description = cmd.description;
      }
    }
    await this.packageRepository.savePackage(pkg);
    // create maintainer
    await this.packageRepository.savePackageMaintainer(pkg.packageId, publisher.userId);

    let pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, cmd.version);
    if (pkgVersion) {
      throw new ForbiddenError(`Can't modify pre-existing version: ${pkgVersion.version}`);
    }

    // add _cnpmcore_publish_time field to cmd.packageJson
    if (!cmd.packageJson._cnpmcore_publish_time) {
      cmd.packageJson._cnpmcore_publish_time = new Date();
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
      this.nfsAdapter.uploadBytes(pkgVersion.abbreviatedDist.path, abbreviatedDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.manifestDist.path, manifestDistBytes),
      this.nfsAdapter.uploadBytes(pkgVersion.readmeDist.path, readmeDistBytes),
    ]);
    await this.packageRepository.createPackageVersion(pkgVersion);
    if (cmd.skipRefreshPackageManifests !== true) {
      await this.refreshPackageManifestsToDists(pkg);
    }
    if (cmd.tag) {
      await this.savePackageTag(pkg, cmd.tag, cmd.version);
    }
    this.eventBus.emit(PACKAGE_VERSION_ADDED, pkgVersion.packageId, pkgVersion.packageVersionId, pkgVersion.version);
    return pkgVersion;
  }

  async replacePackageMaintainers(pkg: Package, maintainers: User[]) {
    await this.packageRepository.replacePackageMaintainers(pkg.packageId, maintainers.map(m => m.userId));
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
    this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.packageId);
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
      this.eventBus.emit(PACKAGE_MAINTAINER_CHANGED, pkg.packageId);
    }
  }

  async removePackageMaintainer(pkg: Package, maintainer: User) {
    await this.packageRepository.removePackageMaintainer(pkg.packageId, maintainer.userId);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'maintainers');
    this.eventBus.emit(PACKAGE_MAINTAINER_REMOVED, pkg.packageId);
  }

  async listPackageFullManifests(scope: string, name: string, expectEtag?: string) {
    return await this._listPacakgeFullOrAbbreviatedManifests(scope, name, expectEtag, true);
  }

  async listPackageAbbreviatedManifests(scope: string, name: string, expectEtag?: string) {
    return await this._listPacakgeFullOrAbbreviatedManifests(scope, name, expectEtag, false);
  }

  async findPackageVersionManifest(packageId: string, version: string) {
    const packageVersion = await this.packageRepository.findPackageVersion(packageId, version);
    if (packageVersion) {
      const [ packageVersionJson, readme ] = await Promise.all([
        this.readDistBytesToJSON(packageVersion.manifestDist),
        this.readDistBytesToString(packageVersion.readmeDist),
      ]);
      packageVersionJson.readme = readme;
      return packageVersionJson;
    }
  }

  async downloadPackageVersionTar(packageVersion: PackageVersion): Promise<string | Readable | undefined> {
    this.plusPackageVersionCounter(packageVersion);
    return await this.nfsAdapter.getDownloadUrlOrStream(packageVersion.tarDist.path);
  }

  async readDistBytesToJSON(dist: Dist) {
    const str = await this.readDistBytesToString(dist);
    if (str) {
      return JSON.parse(str);
    }
  }

  async readDistBytesToString(dist: Dist): Promise<string> {
    const bytes = await this.readDistBytes(dist);
    if (!bytes) return '';
    return Buffer.from(bytes).toString('utf8');
  }

  async readDistBytes(dist: Dist): Promise<Uint8Array | undefined> {
    return await this.nfsAdapter.getBytes(dist.path);
  }

  // will be call by schedule/SavePackageVersionDownloadCounter.ts
  async savePackageVersionCounters() {
    // { [packageId]: { [version]: number } }
    const counters = PackageManagerService.downloadCounters;
    const packageIds = Object.keys(counters);
    if (packageIds.length === 0) return;

    PackageManagerService.downloadCounters = {};
    this.logger.info('[packageManagerService.savePackageVersionCounters:saving] %d packageIds', packageIds.length);

    let total = 0;
    for (const packageId in counters) {
      const versions = counters[packageId];
      for (const version in versions) {
        const counter = versions[version];
        await this.packageVersionDownloadRepository.plus(packageId, version, counter);
        total += counter;
      }
    }
    this.logger.info('[packageManagerService.savePackageVersionCounters:saved] %d total', total);
  }

  public async saveDeprecatedVersions(pkg: Package, deprecateds: { version: string; deprecated: string }[]) {
    for (const { version, deprecated } of deprecateds) {
      const pkgVersion = await this.packageRepository.findPackageVersion(pkg.packageId, version);
      if (!pkgVersion) continue;
      const message = deprecated === '' ? undefined : deprecated;
      await this.mergeManifestDist(pkgVersion.manifestDist, { deprecated: message });
      await this.mergeManifestDist(pkgVersion.abbreviatedDist, { deprecated: message });
      await this.packageRepository.savePackageVersion(pkgVersion);
    }
    await this.refreshPackageManifestsToDists(pkg);
  }

  public async savePackageVersionManifest(pkgVersion: PackageVersion, mergeManifest: object, mergeAbbreviated: object) {
    await this.mergeManifestDist(pkgVersion.manifestDist, mergeManifest);
    await this.mergeManifestDist(pkgVersion.abbreviatedDist, mergeAbbreviated);
  }

  public async removePackageVersion(pkg: Package, pkgVersion: PackageVersion) {
    // remove nfs dists
    await Promise.all([
      this.nfsAdapter.remove(pkgVersion.abbreviatedDist.path),
      this.nfsAdapter.remove(pkgVersion.manifestDist.path),
      this.nfsAdapter.remove(pkgVersion.readmeDist.path),
      this.nfsAdapter.remove(pkgVersion.tarDist.path),
    ]);
    // remove from repository
    await this.packageRepository.removePackageVersion(pkgVersion);
    // all versions removed
    const versions = await this.packageRepository.listPackageVersionNames(pkg.packageId);
    if (versions.length > 0) {
      // make sure latest tag exists
      const tags = await this.packageRepository.listPackageTags(pkg.packageId);
      const latestTag = tags.find(t => t.tag === 'latest');
      if (latestTag && latestTag.version === pkgVersion.version) {
        // change latest version
        // https://github.com/npm/libnpmpublish/blob/main/unpublish.js#L62
        const latestVersion = versions.sort(semver.compareLoose).pop();
        if (latestVersion) {
          latestTag.version = latestVersion;
          await this.packageRepository.savePackageTag(latestTag);
        }
      }
    } else {
      // set unpublished dist to package's manifestDist and abbreviatedDist
      const unpublishedInfo = {
        _id: pkg.fullname,
        name: pkg.fullname,
        time: {
          modified: pkg.updatedAt,
          unpublished: new Date(),
        },
      };
      await this.mergeManifestDist(pkg.manifestsDist!, undefined, unpublishedInfo);
      await this.mergeManifestDist(pkg.abbreviatedsDist!, undefined, unpublishedInfo);
    }
    // refresh manifest dist
    await this.refreshPackageManifestsToDists(pkg);
    this.eventBus.emit(PACKAGE_VERSION_REMOVED, pkg.packageId, pkgVersion.packageVersionId, pkgVersion.version);
  }

  public async savePackageTag(pkg: Package, tag: string, version: string) {
    let tagEntity = await this.packageRepository.findPackageTag(pkg.packageId, tag);
    if (!tagEntity) {
      tagEntity = PackageTag.create({
        packageId: pkg.packageId,
        tag,
        version,
      });
      await this.packageRepository.savePackageTag(tagEntity);
      await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
      this.eventBus.emit(PACKAGE_TAG_ADDED, tagEntity.packageId, tagEntity.packageTagId, tagEntity.tag);
      return true;
    }
    if (tagEntity.version === version) {
      // nothing change
      return false;
    }
    tagEntity.version = version;
    await this.packageRepository.savePackageTag(tagEntity);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
    this.eventBus.emit(PACKAGE_TAG_CHANGED, tagEntity.packageId, tagEntity.packageTagId, tagEntity.tag);
    return true;
  }

  public async removePackageTag(pkg: Package, tag: string) {
    const tagEntity = await this.packageRepository.findPackageTag(pkg.packageId, tag);
    if (!tagEntity) return false;
    await this.packageRepository.removePackageTag(tagEntity);
    await this._refreshPackageManifestRootAttributeOnlyToDists(pkg, 'dist-tags');
    this.eventBus.emit(PACKAGE_TAG_REMOVED, pkg.packageId, tagEntity.packageTagId, tagEntity.tag);
    return true;
  }

  // refresh package full manifests and abbreviated manifests to NFS
  public async refreshPackageManifestsToDists(pkg: Package) {
    const [
      fullManifests,
      abbreviatedManifests,
    ] = await Promise.all([
      await this._listPackageFullManifests(pkg),
      await this._listPackageAbbreviatedManifests(pkg),
    ]);
    await this.updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
  }

  // only refresh root attributes only, e.g.: dist-tags, maintainers
  private async _refreshPackageManifestRootAttributeOnlyToDists(pkg: Package, refreshAttr: 'dist-tags' | 'maintainers') {
    if (refreshAttr === 'maintainers') {
      const fullManifests = await this.readDistBytesToJSON(pkg.manifestsDist!);
      const maintainers = await this._listPackageMaintainers(pkg);
      fullManifests.maintainers = maintainers;
      await this.updatePackageManifestsToDists(pkg, fullManifests, null);
    } else if (refreshAttr === 'dist-tags') {
      const fullManifests = await this.readDistBytesToJSON(pkg.manifestsDist!);
      const abbreviatedManifests = await this.readDistBytesToJSON(pkg.abbreviatedsDist!);
      const tags = await this.packageRepository.listPackageTags(pkg.packageId);
      const distTags: { [key: string]: string} = {};
      for (const tag of tags) {
        distTags[tag.tag] = tag.version;
      }
      fullManifests['dist-tags'] = distTags;
      abbreviatedManifests['dist-tags'] = distTags;
      await this.updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    }
  }

  private async mergeManifestDist(manifestDist: Dist, mergeData?: any, replaceData?: any) {
    let manifest = await this.readDistBytesToJSON(manifestDist);
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
    await this.nfsAdapter.uploadBytes(manifestDist.path, manifestBytes);
  }

  private plusPackageVersionCounter(packageVersion: PackageVersion) {
    // set counter + 1, schedule will store them into database
    const counters = PackageManagerService.downloadCounters;
    if (!counters[packageVersion.packageId]) counters[packageVersion.packageId] = {};
    counters[packageVersion.packageId][packageVersion.version] =
      (counters[packageVersion.packageId][packageVersion.version] || 0) + 1;
  }

  private isFresh(expectEtag: string | undefined, currentEtag: string): boolean {
    if (!expectEtag) return false;
    const reqHeaders = { 'if-none-match': expectEtag };
    const resHeaders = { etag: currentEtag };
    return fresh(reqHeaders, resHeaders);
  }

  private async updatePackageManifestsToDists(pkg: Package, fullManifests: object | null, abbreviatedManifests: object | null): Promise<void> {
    if (fullManifests) {
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
      await this.nfsAdapter.uploadBytes(pkg.manifestsDist.path, fullManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, true);
    }
    if (abbreviatedManifests) {
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
      await this.nfsAdapter.uploadBytes(pkg.abbreviatedsDist.path, abbreviatedManifestsDistBytes);
      await this.packageRepository.savePackageDist(pkg, false);
    }
  }

  private async _listPacakgeFullOrAbbreviatedManifests(scope: string, name: string, expectEtag: string | undefined, isFullManifests: boolean) {
    let etag = '';
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) return { etag, data: null };
    let dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    // read from dist
    if (dist?.distId) {
      etag = `"${dist.shasum}"`;
      if (this.isFresh(expectEtag, etag)) {
        return { etag, data: null };
      }
      const data = await this.readDistBytesToJSON(dist);
      return { etag, data };
    }

    // read from database
    const fullManifests = isFullManifests ? await this._listPackageFullManifests(pkg) : null;
    const abbreviatedManifests = isFullManifests ? null : await this._listPackageAbbreviatedManifests(pkg);
    if (!fullManifests && !abbreviatedManifests) {
      // not exists
      return { etag, data: null };
    }
    await this.updatePackageManifestsToDists(pkg, fullManifests, abbreviatedManifests);
    dist = isFullManifests ? pkg.manifestsDist : pkg.abbreviatedsDist;
    etag = `"${dist?.shasum}"`;
    return { etag, data: fullManifests || abbreviatedManifests };
  }

  private async _listPackageMaintainers(pkg: Package) {
    const maintainers: { name: string; email: string; }[] = [];
    const users = await this.packageRepository.listPackageMaintainers(pkg.packageId);
    for (const user of users) {
      maintainers.push({ name: user.name, email: user.email });
    }
    return maintainers;
  }

  private async _listPackageFullManifests(pkg: Package): Promise<object | null> {
    // read all verions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    const maintainers = await this._listPackageMaintainers(pkg);
    const data = {
      _attachments: {},
      _id: `${pkg.fullname}`,
      _rev: `${pkg.id}-${pkg.packageId}`,
      author: {},
      description: pkg.description,
      'dist-tags': {
        // latest: '1.0.0',
      },
      license: undefined,
      maintainers,
      name: pkg.fullname,
      readme: '',
      readmeFilename: undefined,
      time: {
        // '1.0.0': '2012-09-18T14:46:08.346Z',
        created: pkg.createdAt,
        modified: pkg.updatedAt,
      },
      versions: {},
    };
    // FIXME: get all tags
    let lastestTagVersion = '';
    const tags = await this.packageRepository.listPackageTags(pkg.packageId);
    for (const tag of tags) {
      data['dist-tags'][tag.tag] = tag.version;
      if (tag.tag === 'latest') {
        lastestTagVersion = tag.version;
      }
    }

    let latestManifest: any;
    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    for (const packageVersion of packageVersions) {
      const manifest = await this.readDistBytesToJSON(packageVersion.manifestDist);
      if (!manifest) continue;
      if (lastestTagVersion && packageVersion.version === lastestTagVersion) {
        latestManifest = manifest;
        // set readme
        data.readme = await this.readDistBytesToString(packageVersion.readmeDist);
      }
      data.versions[packageVersion.version] = manifest;
      data.time[packageVersion.version] = packageVersion.publishTime;
    }
    if (!latestManifest) {
      latestManifest = data.versions[packageVersions[0].version];
      const firstPkgVersion = packageVersions[0];
      data.readme = await this.readDistBytesToString(firstPkgVersion.readmeDist);
    }
    if (latestManifest) {
      data.license = latestManifest.license;
      data.author = latestManifest.author;
      data.readmeFilename = latestManifest.readmeFilename;
    }
    return data;
  }

  private async _listPackageAbbreviatedManifests(pkg: Package): Promise<object | null> {
    // read all verions from db
    const packageVersions = await this.packageRepository.listPackageVersions(pkg.packageId);
    if (packageVersions.length === 0) return null;

    // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#package-metadata
    // tiny-tarball is a small package with only one version and no dependencies.
    const data = {
      'dist-tags': {
        // latest: '1.0.0',
      },
      modified: pkg.updatedAt,
      name: pkg.fullname,
      versions: {},
    };
    const tags = await this.packageRepository.listPackageTags(pkg.packageId);
    for (const tag of tags) {
      data['dist-tags'][tag.tag] = tag.version;
    }

    for (const packageVersion of packageVersions) {
      const manifest = await this.readDistBytesToJSON(packageVersion.abbreviatedDist);
      data.versions[packageVersion.version] = manifest;
    }
    return data;
  }
}
