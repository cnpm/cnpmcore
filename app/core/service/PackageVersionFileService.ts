import fs from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import tar from '@fengmk2/tar';
import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import {
  calculateIntegrity,
} from '../../common/PackageUtil';
import { createTempDir, mimeLookup } from '../../common/FileUtil';
import {
  PackageRepository,
} from '../../repository/PackageRepository';
import { PackageVersionFileRepository } from '../../repository/PackageVersionFileRepository';
import { DistRepository } from '../../repository/DistRepository';
import { PackageVersionFile } from '../entity/PackageVersionFile';
import { PackageVersion } from '../entity/PackageVersion';
import { Package } from '../entity/Package';
import { PackageManagerService } from './PackageManagerService';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { ConflictError } from 'egg-errors';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionFileService extends AbstractService {
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly packageVersionFileRepository: PackageVersionFileRepository;
  @Inject()
  private readonly distRepository: DistRepository;
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  async listPackageVersionFiles(pkgVersion: PackageVersion, directory: string) {
    await this.#ensurePackageVersionFilesSync(pkgVersion);
    return await this.packageVersionFileRepository.listPackageVersionFiles(pkgVersion.packageVersionId, directory);
  }

  async showPackageVersionFile(pkgVersion: PackageVersion, path: string) {
    await this.#ensurePackageVersionFilesSync(pkgVersion);
    const { directory, name } = this.#getDirectoryAndName(path);
    return await this.packageVersionFileRepository.findPackageVersionFile(
      pkgVersion.packageVersionId, directory, name);
  }

  async #ensurePackageVersionFilesSync(pkgVersion: PackageVersion) {
    const hasFiles = await this.packageVersionFileRepository.hasPackageVersionFiles(pkgVersion.packageVersionId);
    if (!hasFiles) {
      const lockRes = await this.cacheAdapter.usingLock(`${pkgVersion.packageVersionId}:syncFiles`, 60, async () => {
        await this.syncPackageVersionFiles(pkgVersion);
      });
      // lock fail
      if (!lockRes) {
        this.logger.warn('[package:version:syncPackageVersionFiles] check lock fail');
        throw new ConflictError('Package version file sync is currently in progress. Please try again later.');
      }
    }

  }

  // 基于 latest version 同步 package readme
  async syncPackageReadme(pkg: Package, latestPkgVersion: PackageVersion) {
    const dirname = `unpkg_${pkg.fullname.replace('/', '_')}@${latestPkgVersion.version}_latest_readme_${randomUUID()}`;
    const tmpdir = await createTempDir(this.config.dataDir, dirname);
    const tarFile = `${tmpdir}.tgz`;
    const readmeFilenames: string[] = [];
    try {
      this.logger.info('[PackageVersionFileService.syncPackageReadme:download-start] dist:%s(path:%s, size:%s) => tarFile:%s',
        latestPkgVersion.tarDist.distId, latestPkgVersion.tarDist.path, latestPkgVersion.tarDist.size, tarFile);
      await this.distRepository.downloadDistToFile(latestPkgVersion.tarDist, tarFile);
      this.logger.info('[PackageVersionFileService.syncPackageReadme:extract-start] tmpdir:%s', tmpdir);
      await tar.extract({
        file: tarFile,
        cwd: tmpdir,
        strip: 1,
        onentry: entry => {
          const filename = this.#formatTarEntryFilename(entry);
          if (!filename) return;
          if (this.#matchReadmeFilename(filename)) {
            readmeFilenames.push(filename);
          }
        },
      });
      if (readmeFilenames.length > 0) {
        const readmeFilename = this.#preferMarkdownReadme(readmeFilenames);
        const readmeFile = join(tmpdir, readmeFilename);
        await this.packageManagerService.savePackageReadme(pkg, readmeFile);
      }
    } catch (err) {
      this.logger.warn('[PackageVersionFileService.syncPackageReadme:error] packageVersionId: %s, readmeFilenames: %j, tmpdir: %s, error: %s',
        latestPkgVersion.packageVersionId, readmeFilenames, tmpdir, err);
      // ignore TAR_BAD_ARCHIVE error
      if (err.code === 'TAR_BAD_ARCHIVE') return;
      throw err;
    } finally {
      try {
        await fs.rm(tarFile, { force: true });
        await fs.rm(tmpdir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn('[PackageVersionFileService.syncPackageReadme:warn] remove tmpdir: %s, error: %s',
          tmpdir, err);
      }
    }
  }

  async syncPackageVersionFiles(pkgVersion: PackageVersion) {
    const files: PackageVersionFile[] = [];
    const pkg = await this.packageRepository.findPackageByPackageId(pkgVersion.packageId);
    if (!pkg) return files;
    const dirname = `unpkg_${pkg.fullname.replace('/', '_')}@${pkgVersion.version}_${randomUUID()}`;
    const tmpdir = await createTempDir(this.config.dataDir, dirname);
    const tarFile = `${tmpdir}.tgz`;
    const paths: string[] = [];
    const readmeFilenames: string[] = [];
    try {
      this.logger.info('[PackageVersionFileService.syncPackageVersionFiles:download-start] dist:%s(path:%s, size:%s) => tarFile:%s',
        pkgVersion.tarDist.distId, pkgVersion.tarDist.path, pkgVersion.tarDist.size, tarFile);
      await this.distRepository.downloadDistToFile(pkgVersion.tarDist, tarFile);
      this.logger.info('[PackageVersionFileService.syncPackageVersionFiles:extract-start] tmpdir:%s', tmpdir);
      await tar.extract({
        file: tarFile,
        cwd: tmpdir,
        strip: 1,
        onentry: entry => {
          const filename = this.#formatTarEntryFilename(entry);
          if (!filename) return;
          paths.push('/' + filename);
          if (this.#matchReadmeFilename(filename)) {
            readmeFilenames.push(filename);
          }
        },
      });
      for (const path of paths) {
        const localFile = join(tmpdir, path);
        const file = await this.#savePackageVersionFile(pkg, pkgVersion, path, localFile);
        files.push(file);
      }
      this.logger.info('[PackageVersionFileService.syncPackageVersionFiles:success] packageVersionId: %s, %d paths, %d files, tmpdir: %s',
        pkgVersion.packageVersionId, paths.length, files.length, tmpdir);
      if (readmeFilenames.length > 0) {
        const readmeFilename = this.#preferMarkdownReadme(readmeFilenames);
        const readmeFile = join(tmpdir, readmeFilename);
        await this.packageManagerService.savePackageVersionReadme(pkgVersion, readmeFile);
      }
      return files;
    } catch (err) {
      this.logger.warn('[PackageVersionFileService.syncPackageVersionFiles:error] packageVersionId: %s, %d paths, tmpdir: %s, error: %s',
        pkgVersion.packageVersionId, paths.length, tmpdir, err);
      // ignore TAR_BAD_ARCHIVE error
      if (err.code === 'TAR_BAD_ARCHIVE') return files;
      throw err;
    } finally {
      try {
        await fs.rm(tarFile, { force: true });
        await fs.rm(tmpdir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn('[PackageVersionFileService.syncPackageVersionFiles:warn] remove tmpdir: %s, error: %s',
          tmpdir, err);
      }
    }
  }

  async #savePackageVersionFile(pkg: Package, pkgVersion: PackageVersion, path: string, localFile: string) {
    const { directory, name } = this.#getDirectoryAndName(path);
    let file = await this.packageVersionFileRepository.findPackageVersionFile(
      pkgVersion.packageVersionId, directory, name);
    if (file) return file;
    const stat = await fs.stat(localFile);
    const distIntegrity = await calculateIntegrity(localFile);
    // make sure dist.path store to ascii, e.g. '/resource/ToOneFromχ.js' => '/resource/ToOneFrom%CF%87.js'
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI
    const distPath = encodeURI(path);
    const dist = pkg.createPackageVersionFile(distPath, pkgVersion.version, {
      size: stat.size,
      shasum: distIntegrity.shasum,
      integrity: distIntegrity.integrity,
    });
    await this.distRepository.saveDist(dist, localFile);
    file = PackageVersionFile.create({
      packageVersionId: pkgVersion.packageVersionId,
      directory,
      name,
      dist,
      contentType: mimeLookup(path),
      mtime: pkgVersion.publishTime,
    });
    try {
      await this.packageVersionFileRepository.createPackageVersionFile(file);
      this.logger.info('[PackageVersionFileService.#savePackageVersionFile:success] fileId: %s, size: %s, path: %s',
        file.packageVersionFileId, dist.size, file.path);
    } catch (err) {
      // ignore Duplicate entry
      if (err.code === 'ER_DUP_ENTRY') return file;
      throw err;
    }
    return file;
  }

  #getDirectoryAndName(path: string) {
    return {
      directory: dirname(path),
      name: basename(path),
    };
  }

  #formatTarEntryFilename(entry: tar.ReadEntry) {
    if (entry.type !== 'File') return;
    // ignore hidden dir
    if (entry.path.includes('/./')) return;
    // https://github.com/cnpm/cnpmcore/issues/452#issuecomment-1570077310
    // strip first dir, e.g.: 'package/', 'lodash-es/'
    const filename = entry.path.split('/').slice(1).join('/');
    return filename;
  }

  #matchReadmeFilename(filename: string) {
    // support README,README.*
    // https://github.com/npm/read-package-json/blob/main/lib/read-json.js#L280
    return (/^README(\.\w{1,20}|$)/i.test(filename));
  }

  // https://github.com/npm/read-package-json/blob/main/lib/read-json.js#L280
  #preferMarkdownReadme(files: string[]) {
    let fallback = 0;
    const markdownRE = /\.m?a?r?k?d?o?w?n?$/i;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (markdownRE.test(file)) {
        return file;
      } else if (file.toLowerCase() === 'README') {
        fallback = i;
      }
    }
    // prefer README.md, followed by README; otherwise, return
    // the first filename (which could be README)
    return files[fallback];
  }
}
